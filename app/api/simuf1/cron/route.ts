import { NextResponse } from "next/server";
import { getCircuitConfigForWeekKey, profileLabel } from "@/app/dashboard/simuf1/circuit-config";
import { simulateRaceFromEntries } from "@/app/dashboard/simuf1/simulator";
import type {
  SimuF1CarSetup,
  SimuF1Entry,
  SimuF1Race,
  SimuF1RaceResult,
  SimuF1SeasonStandings,
} from "@/app/dashboard/simuf1/types";
import { getServerFirestore, serverTimestamp } from "@/lib/firebase-server";

export const runtime = "nodejs";

const PARIS_TZ = "Europe/Paris";

const isoWeekKeyFromUtcDate = (date: Date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const getParisNowParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
  };
};

const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const getOffsetMinutesParis = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: PARIS_TZ, timeZoneName: "shortOffset" }).formatToParts(date);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  const m = raw.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return 60;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] || "0");
  const mm = Number(m[3] || "0");
  return sign * (hh * 60 + mm);
};

const parisLocalToUtc = (year: number, month: number, day: number, hour: number, minute: number, second: number) => {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const offset = getOffsetMinutesParis(new Date(guess));
    guess = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000;
  }
  return new Date(guess);
};

const parisDateOnlyUtc = (date = new Date()) => {
  const p = getParisNowParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
};

const weekInfoFromParis = (date = new Date(), weekOffset = 0) => {
  const base = parisDateOnlyUtc(date);
  const p = getParisNowParts(date);
  const weekday = weekdayMap[p.weekday] ?? 0;
  const daysUntilSunday = (7 - weekday) % 7;

  const sunday = new Date(base);
  sunday.setUTCDate(sunday.getUTCDate() + daysUntilSunday + weekOffset * 7);

  const monday = new Date(sunday);
  monday.setUTCDate(monday.getUTCDate() - 6);

  const weekKey = isoWeekKeyFromUtcDate(monday);
  const sundayDateISO = sunday.toISOString().slice(0, 10);
  return { weekKey, sundayDateISO };
};

const isRaceDueInParis = (sundayDateISO: string) => {
  const [y, m, d] = String(sundayDateISO || "").split("-").map(Number);
  if (!y || !m || !d) return false;
  const target = parisLocalToUtc(y, m, d, 12, 0, 0);
  return Date.now() >= target.getTime();
};

const isServerFirestoreConfigured = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return true;
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
};

const defaultCarSetup = (pilotName: string): SimuF1CarSetup => ({
  pilotName,
  bloc: 5,
  grip: 5,
  audace: 5,
  defense: 5,
  endurance: 5,
  pneus: 5,
  pitStops: 1,
  pitLaps: [5],
});

const normalizeCarSetup = (car: Partial<SimuF1CarSetup> | undefined, fallbackPilotName: string): SimuF1CarSetup => {
  const base = defaultCarSetup(fallbackPilotName);
  const source = car || {};
  const normalizedPitStops = Math.max(0, Math.min(3, Math.round(Number(source.pitStops ?? base.pitStops))));

  const normalizedPitLapsRaw = Array.isArray(source.pitLaps) ? source.pitLaps : base.pitLaps;
  const normalizedPitLaps: number[] = [];
  for (let idx = 0; idx < normalizedPitStops; idx += 1) {
    const raw = Number(normalizedPitLapsRaw[idx]);
    const fallback = 3 + idx * 2;
    const clamped = Number.isFinite(raw) ? Math.max(1, Math.min(9, Math.round(raw))) : fallback;
    const prev = idx === 0 ? 0 : normalizedPitLaps[idx - 1];
    normalizedPitLaps.push(Math.min(9, Math.max(clamped, prev + (idx === 0 ? 0 : 1))));
  }

  const statKeys: Array<keyof SimuF1CarSetup> = ["bloc", "grip", "audace", "defense", "endurance", "pneus"];
  const stats = statKeys.map((key) => {
    const raw = Number(source[key] ?? base[key]);
    const n = Number.isFinite(raw) ? Math.round(raw) : Number(base[key]);
    return Math.max(1, Math.min(10, n));
  });

  const targetStatSum = 31 - normalizedPitStops;
  let delta = targetStatSum - stats.reduce((sum, n) => sum + n, 0);
  while (delta !== 0) {
    const dir = delta > 0 ? 1 : -1;
    let moved = false;
    for (let i = 0; i < stats.length; i += 1) {
      const next = stats[i] + dir;
      if (next < 1 || next > 10) continue;
      stats[i] = next;
      delta -= dir;
      moved = true;
      if (delta === 0) break;
    }
    if (!moved) break;
  }

  return {
    pilotName: String(source.pilotName || "").trim() || fallbackPilotName,
    bloc: stats[0],
    grip: stats[1],
    audace: stats[2],
    defense: stats[3],
    endurance: stats[4],
    pneus: stats[5],
    pitStops: normalizedPitStops,
    pitLaps: normalizedPitLaps,
  };
};

const normalizeEntryCars = (entry: SimuF1Entry): SimuF1Entry => {
  const incoming = Array.isArray(entry.cars) ? entry.cars : [];
  const car1 = normalizeCarSetup(incoming[0], "Pilote 1");
  const car2 = normalizeCarSetup(incoming[1], "Pilote 2");
  return {
    ...entry,
    cars: [car1, car2],
  };
};

const ensureRaceForOffset = async (seasonYear: number, weekOffset: number) => {
  const db = getServerFirestore();
  const { weekKey, sundayDateISO } = weekInfoFromParis(new Date(), weekOffset);
  const raceId = `${seasonYear}-${weekKey}`;
  const circuit = getCircuitConfigForWeekKey(weekKey);
  const raceRef = db.collection("simuf1Races").doc(raceId);
  const raceSnap = await raceRef.get();

  const payload = {
    id: raceId,
    seasonYear,
    weekKey,
    sundayDateISO,
    circuitName: circuit.circuitName,
    circuitProfile: profileLabel(circuit.profile),
    boostedStats: circuit.boosted,
    penalizedStats: circuit.penalized,
    updatedAt: serverTimestamp(),
  };

  if (!raceSnap.exists) {
    await raceRef.set({
      ...payload,
      status: "open",
      createdAt: serverTimestamp(),
    } as SimuF1Race, { merge: true });
  } else {
    await raceRef.set(payload, { merge: true });
  }

  const finalSnap = await raceRef.get();
  const data = finalSnap.data() as Partial<SimuF1Race>;
  return {
    raceId,
    weekKey,
    sundayDateISO,
    status: String(data?.status || "open"),
    circuitName: String(data?.circuitName || circuit.circuitName),
  };
};

const recomputeSeasonStandings = async (seasonYear: number) => {
  const db = getServerFirestore();

  const raceSnap = await db.collection("simuf1Races").get();
  const races = raceSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Partial<SimuF1Race>) }))
    .filter((r) => Number(r.seasonYear || 0) === seasonYear);

  const teams: Record<string, number> = {};
  const drivers: Record<string, number> = {};

  for (const race of races) {
    const resultSnap = await db.collection("simuf1Races").doc(String(race.id)).collection("results").doc("latest").get();
    if (!resultSnap.exists) continue;
    const result = resultSnap.data() as SimuF1RaceResult;

    for (const car of result.cars || []) {
      teams[car.teamName] = (teams[car.teamName] || 0) + car.points;
      drivers[car.pilotName] = (drivers[car.pilotName] || 0) + car.points;
    }
  }

  await db.collection("simuf1Seasons").doc(String(seasonYear)).set({
    seasonYear,
    teams,
    drivers,
    updatedAt: serverTimestamp(),
  } as SimuF1SeasonStandings, { merge: true });
};

const runRaceSimulationAndPersist = async (raceId: string, seasonYear: number) => {
  const db = getServerFirestore();

  const raceRef = db.collection("simuf1Races").doc(raceId);
  const raceSnap = await raceRef.get();
  if (!raceSnap.exists) {
    throw new Error(`Course introuvable: ${raceId}`);
  }

  const race = raceSnap.data() as SimuF1Race;
  if (race.status === "published") {
    return { executed: false, reason: "already_published" as const };
  }

  const entrySnap = await raceRef.collection("entries").get();
  const entries = await Promise.all(entrySnap.docs.map(async (d) => {
    const rawEntry = d.data() as SimuF1Entry;
    const normalized = normalizeEntryCars(rawEntry);
    if (JSON.stringify(rawEntry.cars || []) !== JSON.stringify(normalized.cars || [])) {
      await raceRef.collection("entries").doc(d.id).set(
        {
          ...normalized,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return normalized;
  }));

  const result = simulateRaceFromEntries(raceId, seasonYear, entries, race.weekKey);

  await raceRef.collection("results").doc("latest").set({
    ...result,
    generatedAt: serverTimestamp(),
  } as SimuF1RaceResult, { merge: true });

  await raceRef.set({
    status: "published",
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await recomputeSeasonStandings(seasonYear);

  return {
    executed: true,
    reason: "simulated" as const,
    resultCars: result.cars.length,
  };
};

const isAuthorized = (request: Request) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return token === expected;
};

const runCron = async () => {
  const seasonYear = Number(process.env.SIMUF1_SEASON_YEAR || "2026") || 2026;

  const current = await ensureRaceForOffset(seasonYear, 0);
  const due = isRaceDueInParis(current.sundayDateISO);

  let execution: {
    executed: boolean;
    reason: "already_published" | "simulated";
    resultCars?: number;
  } = {
    executed: false,
    reason: "already_published",
  };

  if (due && current.status !== "published") {
    execution = await runRaceSimulationAndPersist(current.raceId, seasonYear);
  }

  const next = await ensureRaceForOffset(seasonYear, 1);

  return {
    ok: true,
    parisNow: new Date().toLocaleString("fr-FR", { timeZone: PARIS_TZ }),
    due,
    seasonYear,
    currentRace: current,
    execution,
    nextRace: next,
  };
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isServerFirestoreConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "missing-admin-credentials",
        error:
          "Firebase Admin credentials missing. Configure FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
      },
      { status: 503 }
    );
  }

  try {
    const report = await runCron();
    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur SimuF1 cron.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
