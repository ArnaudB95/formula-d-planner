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

const isoWeekKey = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const sundayDateISO = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = 7 - day;
  d.setDate(d.getDate() + (diff === 7 ? 0 : diff));
  return d.toISOString().slice(0, 10);
};

const entryDocId = (email: string) => email.replaceAll("/", "_").replaceAll(".", "_");

export const ensureCurrentWeeklyRace = async (seasonYear: number) => {
  const db = getFirestore();
  if (!db) throw new Error("Firestore indisponible");

  const now = new Date();
  const weekKey = isoWeekKey(now);
  const raceId = `${seasonYear}-${weekKey}`;
  const circuit = getCircuitConfigForWeekKey(weekKey);
  const raceRef = doc(db, "simuf1Races", raceId);

  const snapshot = await getDoc(raceRef);
  if (!snapshot.exists()) {
    const payload: SimuF1Race = {
      id: raceId,
      seasonYear,
      weekKey,
      sundayDateISO: sundayDateISO(now),
      circuitName: circuit.circuitName,
      circuitProfile: profileLabel(circuit.profile),
      boostedStats: circuit.boosted,
      penalizedStats: circuit.penalized,
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(raceRef, payload as any, { merge: true });
  } else {
    await setDoc(
      raceRef,
      {
        circuitName: circuit.circuitName,
        circuitProfile: profileLabel(circuit.profile),
        boostedStats: circuit.boosted,
        penalizedStats: circuit.penalized,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return raceId;
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
  const result = simulateRaceFromEntries(raceId, seasonYear, entries, weekKey);

  await setDoc(doc(db, "simuf1Races", raceId, "results", "latest"), {
    ...result,
    generatedAt: serverTimestamp(),
  });

  const seasonRef = doc(db, "simuf1Seasons", String(seasonYear));
  const seasonSnap = await getDoc(seasonRef);
  const current = (seasonSnap.exists() ? seasonSnap.data() : {}) as Partial<SimuF1SeasonStandings>;
  const teams = { ...(current.teams || {}) } as Record<string, number>;
  const drivers = { ...(current.drivers || {}) } as Record<string, number>;

  result.cars.forEach((car) => {
    teams[car.teamName] = (teams[car.teamName] || 0) + car.points;
    drivers[car.pilotName] = (drivers[car.pilotName] || 0) + car.points;
  });

  await setDoc(seasonRef, {
    seasonYear,
    teams,
    drivers,
    updatedAt: serverTimestamp(),
  } as SimuF1SeasonStandings, { merge: true });

  await setDoc(doc(db, "simuf1Races", raceId), {
    status: "published",
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return result;
};
