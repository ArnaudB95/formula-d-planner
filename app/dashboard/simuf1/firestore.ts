"use client";

import { getFirestore } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getCircuitConfigForWeekKey, profileLabel } from "./circuit-config";
import { simulateRaceFromEntries } from "./simulator";
import type {
  SimuF1Entry,
  SimuF1PilotProfile,
  SimuF1Race,
  SimuF1RaceHistoryItem,
  SimuF1RaceResult,
  SimuF1SeasonStandings,
} from "./types";

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
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
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

const upsertWeeklyRace = async (seasonYear: number, weekOffset = 0) => {
  const db = getFirestore();
  if (!db) throw new Error("Firestore indisponible");

  const { weekKey, sundayDateISO } = weekInfoFromParis(new Date(), weekOffset);
  const raceId = `${seasonYear}-${weekKey}`;
  const circuit = getCircuitConfigForWeekKey(weekKey);
  const raceRef = doc(db, "simuf1Races", raceId);

  const snapshot = await getDoc(raceRef);
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

  if (!snapshot.exists()) {
    await setDoc(raceRef, {
      ...payload,
      status: "open",
      createdAt: serverTimestamp(),
    } as SimuF1Race, { merge: true });
  } else {
    await setDoc(raceRef, payload, { merge: true });
  }

  return {
    raceId,
    snapshot,
    weekKey,
    sundayDateISO,
  };
};

const entryDocId = (email: string) => email.replaceAll("/", "_").replaceAll(".", "_");

export const ensureCurrentWeeklyRace = async (seasonYear: number) => {
  const current = await upsertWeeklyRace(seasonYear, 0);
  const currentData = current.snapshot.exists() ? (current.snapshot.data() as Partial<SimuF1Race>) : null;
  const currentStatus = String(currentData?.status || "open");
  const currentSunday = String(currentData?.sundayDateISO || current.sundayDateISO);

  if (currentStatus === "published" && isRaceDueInParis(currentSunday)) {
    const next = await upsertWeeklyRace(seasonYear, 1);
    return next.raceId;
  }

  return current.raceId;
};

export const ensureNextWeeklyRace = async (seasonYear: number) => {
  const next = await upsertWeeklyRace(seasonYear, 1);
  return next.raceId;
};

export const subscribeRace = (raceId: string, cb: (race: SimuF1Race | null) => void) => {
  const db = getFirestore();
  if (!db) return () => {};
  return onSnapshot(doc(db, "simuf1Races", raceId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as SimuF1Race) : null);
  });
};

export const saveEntry = async (raceId: string, entry: SimuF1Entry) => {
  const db = getFirestore();
  if (!db) throw new Error("Firestore indisponible");
  const ref = doc(db, "simuf1Races", raceId, "entries", entryDocId(entry.userEmail));
  await setDoc(ref, { ...entry, updatedAt: serverTimestamp() }, { merge: true });
};

export const subscribeEntry = (raceId: string, userEmail: string, cb: (entry: SimuF1Entry | null) => void) => {
  const db = getFirestore();
  if (!db) return () => {};
  return onSnapshot(doc(db, "simuf1Races", raceId, "entries", entryDocId(userEmail)), (snap) => {
    cb(snap.exists() ? (snap.data() as SimuF1Entry) : null);
  });
};

export const subscribeEntries = (raceId: string, cb: (entries: SimuF1Entry[]) => void) => {
  const db = getFirestore();
  if (!db) return () => {};
  const q = query(collection(db, "simuf1Races", raceId, "entries"), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    cb(snapshot.docs.map((d) => d.data() as SimuF1Entry));
  });
};

export const subscribeLatestRaceResult = (raceId: string, cb: (result: SimuF1RaceResult | null) => void) => {
  const db = getFirestore();
  if (!db) return () => {};
  return onSnapshot(doc(db, "simuf1Races", raceId, "results", "latest"), (snap) => {
    cb(snap.exists() ? (snap.data() as SimuF1RaceResult) : null);
  });
};

export const subscribeRaceResult = (raceId: string, cb: (result: SimuF1RaceResult | null) => void) => {
  return subscribeLatestRaceResult(raceId, cb);
};

export const subscribeSeasonStandings = (seasonYear: number, cb: (standings: SimuF1SeasonStandings | null) => void) => {
  const db = getFirestore();
  if (!db) return () => {};
  return onSnapshot(doc(db, "simuf1Seasons", String(seasonYear)), (snap) => {
    cb(snap.exists() ? (snap.data() as SimuF1SeasonStandings) : null);
  });
};

export const subscribeRaceHistory = (seasonYear: number, cb: (history: SimuF1RaceHistoryItem[]) => void) => {
  const db = getFirestore();
  if (!db) return () => {};
  const q = query(collection(db, "simuf1Races"), orderBy("sundayDateISO", "desc"));
  return onSnapshot(q, (snapshot) => {
    cb(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SimuF1RaceHistoryItem, "id">),
      })).filter((race) => race.seasonYear === seasonYear)
    );
  });
};

export const subscribePilotProfile = (userEmail: string, cb: (profile: SimuF1PilotProfile | null) => void) => {
  const db = getFirestore();
  if (!db) return () => {};
  const id = entryDocId(userEmail);
  return onSnapshot(doc(db, "simuf1Profiles", id), (snap) => {
    cb(snap.exists() ? (snap.data() as SimuF1PilotProfile) : null);
  });
};

export const savePilotProfile = async (userEmail: string, pilot1Name: string, pilot2Name: string) => {
  const db = getFirestore();
  if (!db) throw new Error("Firestore indisponible");
  const id = entryDocId(userEmail);
  await setDoc(
    doc(db, "simuf1Profiles", id),
    {
      userEmail,
      pilot1Name,
      pilot2Name,
      updatedAt: serverTimestamp(),
    } as SimuF1PilotProfile,
    { merge: true }
  );
};

const recomputeSeasonStandings = async (seasonYear: number) => {
  const db = getFirestore();
  if (!db) return;

  const raceSnap = await getDocs(collection(db, "simuf1Races"));
  const raceIds = raceSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((r) => r.seasonYear === seasonYear)
    .map((r) => r.id as string);

  const teams: Record<string, number> = {};
  const drivers: Record<string, number> = {};

  for (const raceId of raceIds) {
    const resultRef = doc(db, "simuf1Races", raceId, "results", "latest");
    const resultSnap = await getDoc(resultRef);
    if (!resultSnap.exists()) continue;
    const result = resultSnap.data() as SimuF1RaceResult;
    result.cars.forEach((car) => {
      teams[car.teamName] = (teams[car.teamName] || 0) + car.points;
      drivers[car.pilotName] = (drivers[car.pilotName] || 0) + car.points;
    });
  }

  await setDoc(
    doc(db, "simuf1Seasons", String(seasonYear)),
    {
      seasonYear,
      teams,
      drivers,
      updatedAt: serverTimestamp(),
    } as SimuF1SeasonStandings,
    { merge: true }
  );
};

export const applyPilotNamesRetroactively = async (
  userEmail: string,
  pilot1Name: string,
  pilot2Name: string,
  seasonYear: number
) => {
  const db = getFirestore();
  if (!db) throw new Error("Firestore indisponible");

  const raceSnap = await getDocs(collection(db, "simuf1Races"));
  const races = raceSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((r) => r.seasonYear === seasonYear);

  for (const race of races) {
    const raceId = String(race.id);
    const entryRef = doc(db, "simuf1Races", raceId, "entries", entryDocId(userEmail));
    const entrySnap = await getDoc(entryRef);
    if (entrySnap.exists()) {
      const entry = entrySnap.data() as SimuF1Entry;
      const cars = [...entry.cars] as [SimuF1Entry["cars"][number], SimuF1Entry["cars"][number]];
      cars[0] = { ...cars[0], pilotName: pilot1Name };
      cars[1] = { ...cars[1], pilotName: pilot2Name };
      await setDoc(entryRef, { ...entry, cars, updatedAt: serverTimestamp() }, { merge: true });
    }

    const resultRef = doc(db, "simuf1Races", raceId, "results", "latest");
    const resultSnap = await getDoc(resultRef);
    if (resultSnap.exists()) {
      const result = resultSnap.data() as SimuF1RaceResult;
      const cars = result.cars.map((car) => {
        if (car.ownerEmail !== userEmail) return car;
        if (car.carId.endsWith("__1")) return { ...car, pilotName: pilot1Name };
        if (car.carId.endsWith("__2")) return { ...car, pilotName: pilot2Name };
        return car;
      });

      const diceLogs = (result.diceLogs || []).map((log) => {
        let actorPilotName = log.actorPilotName;
        let targetPilotName = log.targetPilotName;
        if (log.actorCarId.endsWith("__1") && log.actorCarId.startsWith(userEmail)) actorPilotName = pilot1Name;
        if (log.actorCarId.endsWith("__2") && log.actorCarId.startsWith(userEmail)) actorPilotName = pilot2Name;
        if (log.targetCarId?.endsWith("__1") && log.targetCarId?.startsWith(userEmail)) targetPilotName = pilot1Name;
        if (log.targetCarId?.endsWith("__2") && log.targetCarId?.startsWith(userEmail)) targetPilotName = pilot2Name;
        return { ...log, actorPilotName, targetPilotName };
      });

      await setDoc(resultRef, { ...result, cars, diceLogs, generatedAt: serverTimestamp() }, { merge: true });
    }
  }

  await recomputeSeasonStandings(seasonYear);
};

export const runRaceSimulationAndPersist = async (raceId: string, seasonYear: number) => {
  const db = getFirestore();
  if (!db) throw new Error("Firestore indisponible");

  const entrySnap = await getDocs(collection(db, "simuf1Races", raceId, "entries"));
  const entries = entrySnap.docs.map((d) => d.data() as SimuF1Entry);

  const raceSnap = await getDoc(doc(db, "simuf1Races", raceId));
  const weekKey = (raceSnap.exists() ? (raceSnap.data() as SimuF1Race).weekKey : "") || "";
  const raceSundayDateISO = (raceSnap.exists() ? (raceSnap.data() as SimuF1Race).sundayDateISO : "") || "";
  const result = simulateRaceFromEntries(raceId, seasonYear, entries, weekKey);

  await setDoc(doc(db, "simuf1Races", raceId, "results", "latest"), {
    ...result,
    generatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "simuf1Races", raceId), {
    status: "published",
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await recomputeSeasonStandings(seasonYear);

  if (isRaceDueInParis(String(raceSundayDateISO))) {
    await ensureNextWeeklyRace(seasonYear);
  }

  return result;
};
