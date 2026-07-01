import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getServerFirestore, serverTimestamp } from "@/lib/firebase-server";

type ResultsRaceRow = {
  pilot: string;
  team: string;
  position: number;
  slot?: 1 | 2;
  status?: string;
  teamColor?: string;
  proprietaire?: string;
};

type ResultsRace = {
  id: string;
  circuit: string;
  date: string;
  results: ResultsRaceRow[];
};

type ResultsChampionshipType = "Ecurie" | "Individuel";
type ResultsChampionshipStatus = "en cours" | "terminé" | "";

type ResultsChampionship = {
  key: string;
  title: string;
  championshipType?: ResultsChampionshipType;
  seasonNumber?: number;
  yearLabel?: string;
  status: string;
  championshipStatus?: ResultsChampionshipStatus;
  races: ResultsRace[];
  minParticipations?: number;
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

const normalizeResultsChampionshipType = (value: unknown): ResultsChampionshipType | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "ecurie" || normalized === "equipe") {
    return "Ecurie";
  }

  if (normalized === "individuel") {
    return "Individuel";
  }

  return null;
};

const parseResultsSeasonNumber = (value: unknown) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeResultsYearLabel = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");

const normalizeResultsChampionshipStatus = (value: unknown): ResultsChampionshipStatus => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "en cours") return "en cours";
  if (normalized === "termine") return "terminé";
  return "";
};

const buildResultsChampionshipTitle = ({
  championshipType,
  seasonNumber,
  yearLabel,
}: {
  championshipType: ResultsChampionshipType;
  seasonNumber: number;
  yearLabel: string;
}) => `Championnat ${championshipType} Saison ${seasonNumber} - ${yearLabel}`;

const parseResultsChampionshipTitle = (value: unknown) => {
  const title = String(value || "").trim();
  const match = title.match(/^Championnat\s+(Ecurie|Écurie|Equipe|Équipe|Individuel)\s+Saison\s+(\d+)\s*-\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const championshipType = normalizeResultsChampionshipType(match[1]);
  const seasonNumber = parseResultsSeasonNumber(match[2]);
  const yearLabel = normalizeResultsYearLabel(match[3]);

  if (!championshipType || seasonNumber === null || !yearLabel) {
    return null;
  }

  return {
    championshipType,
    seasonNumber,
    yearLabel,
  };
};

const extractResultsChampionshipNaming = (body: any) => {
  const championshipType = normalizeResultsChampionshipType(body?.championshipType);
  const seasonNumber = parseResultsSeasonNumber(body?.seasonNumber);
  const yearLabel = normalizeResultsYearLabel(body?.yearLabel);

  if (championshipType && seasonNumber !== null && yearLabel) {
    return {
      championshipType,
      seasonNumber,
      yearLabel,
    };
  }

  return parseResultsChampionshipTitle(body?.title);
};

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

  const handleServerError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "unexpected-server-error";
    console.error("[results-admin]", action, error);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  };

  if (action === "createOrUpdateChampionship") {
    try {
      const status = String(body?.status || "").trim() || "Actif";
      const championshipStatus = normalizeResultsChampionshipStatus(body?.championshipStatus);
      const selectedKey = String(body?.selectedKey || "").trim();
      const naming = extractResultsChampionshipNaming(body);

      if (!naming) {
        return NextResponse.json({ ok: false, message: "invalid-championship-format" }, { status: 400 });
      }

      const title = buildResultsChampionshipTitle(naming);

      const key = selectedKey || slugifyResultsKey(title);
      if (!key) {
        return NextResponse.json({ ok: false, message: "invalid-key" }, { status: 400 });
      }

      const ref = db.collection("resultsChampionships").doc(key);
      const existing = await ref.get();

      const payload: Partial<ResultsChampionship> & Record<string, unknown> = {
        key,
        title,
        championshipType: naming.championshipType,
        seasonNumber: naming.seasonNumber,
        yearLabel: naming.yearLabel,
        status,
        championshipStatus,
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
    } catch (error) {
      return handleServerError(error);
    }
  }

  if (action === "createOrUpdateRace") {
    try {
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
    } catch (error) {
      return handleServerError(error);
    }
  }

  if (action === "updateRaceMeta") {
    try {
      const championshipKey = String(body?.championshipKey || "").trim();
      const sourceRaceId = String(body?.sourceRaceId || "").trim().toUpperCase();
      const raceId = String(body?.raceId || "").trim().toUpperCase();
      const circuit = String(body?.circuit || "").trim();
      const date = String(body?.date || "").trim();

      if (!championshipKey || !sourceRaceId || !raceId || !circuit || !date) {
        return NextResponse.json({ ok: false, message: "missing-fields" }, { status: 400 });
      }

      const ref = db.collection("resultsChampionships").doc(championshipKey);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ ok: false, message: "championship-not-found" }, { status: 404 });
      }

      const data = snap.data() as ResultsChampionship;
      const races = Array.isArray(data.races) ? [...data.races] : [];
      const sourceIndex = races.findIndex((r) => String(r.id || "").toUpperCase() === sourceRaceId);
      if (sourceIndex < 0) {
        return NextResponse.json({ ok: false, message: "race-not-found" }, { status: 404 });
      }

      const targetIndex = races.findIndex((r) => String(r.id || "").toUpperCase() === raceId);
      if (targetIndex >= 0 && targetIndex !== sourceIndex) {
        return NextResponse.json({ ok: false, message: "race-id-already-exists" }, { status: 409 });
      }

      const sourceRace = races[sourceIndex];
      const updatedRace: ResultsRace = {
        ...sourceRace,
        id: raceId,
        circuit,
        date,
        results: Array.isArray(sourceRace.results) ? sourceRace.results : [],
      };

      races[sourceIndex] = updatedRace;

      await ref.set(
        {
          races,
          updatedAt: serverTimestamp(),
          updatedBy: decodedEmail,
        },
        { merge: true }
      );

      return NextResponse.json({ ok: true, raceId });
    } catch (error) {
      return handleServerError(error);
    }
  }

  if (action === "deleteRace") {
    try {
      const championshipKey = String(body?.championshipKey || "").trim();
      const raceId = String(body?.raceId || "").trim().toUpperCase();

      if (!championshipKey || !raceId) {
        return NextResponse.json({ ok: false, message: "missing-fields" }, { status: 400 });
      }

      const ref = db.collection("resultsChampionships").doc(championshipKey);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ ok: false, message: "championship-not-found" }, { status: 404 });
      }

      const data = snap.data() as ResultsChampionship;
      const races = Array.isArray(data.races) ? [...data.races] : [];
      const nextRaces = races.filter((race) => String(race.id || "").toUpperCase() !== raceId);
      if (nextRaces.length === races.length) {
        return NextResponse.json({ ok: false, message: "race-not-found" }, { status: 404 });
      }

      await ref.set(
        {
          races: nextRaces,
          updatedAt: serverTimestamp(),
          updatedBy: decodedEmail,
        },
        { merge: true }
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleServerError(error);
    }
  }

  if (action === "upsertRaceRow") {
    try {
      const championshipKey = String(body?.championshipKey || "").trim();
      const raceId = String(body?.raceId || "").trim().toUpperCase();
      const pilot = String(body?.pilot || "").trim();
      const team = String(body?.team || "").trim();
      const status = String(body?.status || "").trim().toUpperCase();
      const teamColor = String(body?.teamColor || "").trim();
      const proprietaire = String(body?.proprietaire || "").trim();
      const slotRaw = Number.parseInt(String(body?.slot || ""), 10);
      const slot = slotRaw === 1 || slotRaw === 2 ? (slotRaw as 1 | 2) : undefined;
      const positionRaw = Number.parseInt(String(body?.position || "0"), 10);
      const position = Number.isFinite(positionRaw) && positionRaw > 0 ? positionRaw : 0;

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
      const normalizeKey = (value: string) => String(value || "").trim().toLowerCase();
      const pilotKey = normalizeKey(pilot);
      const teamKey = normalizeKey(team);

      // Match priority:
      // 1) Same team + same slot (stable Pilote 1/Pilote 2 per ecurie)
      // 2) Same team + same pilot (rename-safe inside same ecurie)
      // 3) Same pilot globally (legacy fallback when old rows had no slot)
      const rowIndexByTeamAndSlot = slot
        ? rows.findIndex((row) => normalizeKey(String(row.team || "")) === teamKey && row.slot === slot)
        : -1;
      const rowIndexByTeamAndPilot = rows.findIndex(
        (row) => normalizeKey(String(row.team || "")) === teamKey && normalizeKey(String(row.pilot || "")) === pilotKey
      );
      const rowIndexByPilot = rows.findIndex((row) => normalizeKey(String(row.pilot || "")) === pilotKey);
      const rowIndex =
        rowIndexByTeamAndSlot >= 0
          ? rowIndexByTeamAndSlot
          : rowIndexByTeamAndPilot >= 0
            ? rowIndexByTeamAndPilot
            : rowIndexByPilot;
      const payload: ResultsRaceRow = {
        pilot,
        team,
        position,
        ...(slot ? { slot } : {}),
        ...(status ? { status } : {}),
        ...(teamColor ? { teamColor } : {}),
        ...(proprietaire ? { proprietaire } : {}),
      };

      if (rowIndex >= 0) rows[rowIndex] = payload;
      else rows.push(payload);

      rows.sort((a, b) => {
        const left = Number.isFinite(a.position) && a.position > 0 ? a.position : Number.POSITIVE_INFINITY;
        const right = Number.isFinite(b.position) && b.position > 0 ? b.position : Number.POSITIVE_INFINITY;
        return left - right || a.pilot.localeCompare(b.pilot);
      });
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
    } catch (error) {
      return handleServerError(error);
    }
  }

  if (action === "updateMinParticipations") {
    try {
      const championshipKey = String(body?.championshipKey || "").trim();
      const minParticipations = Number(body?.minParticipations);

      if (!championshipKey) {
        return NextResponse.json({ ok: false, message: "missing-fields" }, { status: 400 });
      }

      if (isNaN(minParticipations) || minParticipations < 0) {
        return NextResponse.json({ ok: false, message: "invalid-min-participations" }, { status: 400 });
      }

      const ref = db.collection("resultsChampionships").doc(championshipKey);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ ok: false, message: "championship-not-found" }, { status: 404 });
      }

      await ref.set(
        {
          minParticipations,
          updatedAt: serverTimestamp(),
          updatedBy: decodedEmail,
        },
        { merge: true }
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleServerError(error);
    }
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
