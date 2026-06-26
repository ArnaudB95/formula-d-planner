import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getServerFirestore, serverTimestamp } from "@/lib/firebase-server";

type ResultsRaceRow = {
  pilot: string;
  team: string;
  position: number;
  status?: string;
};

type ResultsRace = {
  id: string;
  circuit: string;
  date: string;
  results: ResultsRaceRow[];
};

type ResultsChampionship = {
  key: string;
  title: string;
  status: string;
  races: ResultsRace[];
};

const SUPER_ADMIN_EMAIL = "beaudouin.arnaud@gmail.com";

const normalizeEmail = (value: string | null | undefined) => String(value || "").trim().toLowerCase();

const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
};

const slugifyResultsKey = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, message: "missing-token" }, { status: 401 });
  }

  // Ensure Firebase Admin app is initialized before token verification.
  getServerFirestore();

  let decodedEmail = "";
  try {
    const decoded = await getAuth().verifyIdToken(token);
    decodedEmail = normalizeEmail(decoded.email || "");
  } catch {
    return NextResponse.json({ ok: false, message: "invalid-token" }, { status: 401 });
  }

  if (decodedEmail !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid-json" }, { status: 400 });
  }

  const action = String(body?.action || "").trim();
  const db = getServerFirestore();

  if (action === "createOrUpdateChampionship") {
    const title = String(body?.title || "").trim();
    const status = String(body?.status || "").trim() || "Actif";
    const selectedKey = String(body?.selectedKey || "").trim();

    if (!title) {
      return NextResponse.json({ ok: false, message: "title-required" }, { status: 400 });
    }

    const key = selectedKey || slugifyResultsKey(title);
    if (!key) {
      return NextResponse.json({ ok: false, message: "invalid-key" }, { status: 400 });
    }

    const ref = db.collection("resultsChampionships").doc(key);
    const existing = await ref.get();

    const payload: Partial<ResultsChampionship> & Record<string, unknown> = {
      key,
      title,
      status,
      updatedAt: serverTimestamp(),
      updatedBy: decodedEmail,
    };

    if (!existing.exists) {
      payload.races = [];
      payload.createdAt = serverTimestamp();
      payload.createdBy = decodedEmail;
    }

    await ref.set(payload, { merge: true });
    return NextResponse.json({ ok: true, key, created: !existing.exists });
  }

  if (action === "createOrUpdateRace") {
    const championshipKey = String(body?.championshipKey || "").trim();
    const raceId = String(body?.raceId || "").trim().toUpperCase();
    const circuit = String(body?.circuit || "").trim();
    const date = String(body?.date || "").trim();

    if (!championshipKey || !raceId || !circuit || !date) {
      return NextResponse.json({ ok: false, message: "missing-fields" }, { status: 400 });
    }

    const ref = db.collection("resultsChampionships").doc(championshipKey);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, message: "championship-not-found" }, { status: 404 });
    }

    const data = snap.data() as ResultsChampionship;
    const races = Array.isArray(data.races) ? [...data.races] : [];
    const idx = races.findIndex((r) => String(r.id || "").toUpperCase() === raceId);
    if (idx >= 0) {
      races[idx] = { ...races[idx], id: raceId, circuit, date };
    } else {
      races.push({ id: raceId, circuit, date, results: [] });
    }

    await ref.set(
      {
        races,
        updatedAt: serverTimestamp(),
        updatedBy: decodedEmail,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  }

  if (action === "upsertRaceRow") {
    const championshipKey = String(body?.championshipKey || "").trim();
    const raceId = String(body?.raceId || "").trim().toUpperCase();
    const pilot = String(body?.pilot || "").trim();
    const team = String(body?.team || "").trim();
    const status = String(body?.status || "").trim().toUpperCase();
    const positionRaw = Number.parseInt(String(body?.position || "1"), 10);
    const position = Number.isFinite(positionRaw) && positionRaw > 0 ? positionRaw : 1;

    if (!championshipKey || !raceId || !pilot || !team) {
      return NextResponse.json({ ok: false, message: "missing-fields" }, { status: 400 });
    }

    const ref = db.collection("resultsChampionships").doc(championshipKey);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, message: "championship-not-found" }, { status: 404 });
    }

    const data = snap.data() as ResultsChampionship;
    const races = Array.isArray(data.races) ? [...data.races] : [];
    const raceIndex = races.findIndex((r) => String(r.id || "").toUpperCase() === raceId);
    if (raceIndex < 0) {
      return NextResponse.json({ ok: false, message: "race-not-found" }, { status: 404 });
    }

    const race = races[raceIndex];
    const rows = Array.isArray(race.results) ? [...race.results] : [];
    const rowIndex = rows.findIndex((row) => String(row.pilot || "").trim().toLowerCase() === pilot.toLowerCase());
    const payload: ResultsRaceRow = { pilot, team, position, status: status || undefined };

    if (rowIndex >= 0) rows[rowIndex] = payload;
    else rows.push(payload);

    rows.sort((a, b) => a.position - b.position || a.pilot.localeCompare(b.pilot));
    races[raceIndex] = { ...race, results: rows };

    await ref.set(
      {
        races,
        updatedAt: serverTimestamp(),
        updatedBy: decodedEmail,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  }

  if (action === "deleteChampionship") {
    const championshipKey = String(body?.championshipKey || "").trim();
    if (!championshipKey) {
      return NextResponse.json({ ok: false, message: "missing-fields" }, { status: 400 });
    }

    const ref = db.collection("resultsChampionships").doc(championshipKey);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, message: "championship-not-found" }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "unknown-action" }, { status: 400 });
}
