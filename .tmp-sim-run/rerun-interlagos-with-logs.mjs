import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { simulateRaceFromEntries } from "./app/dashboard/simuf1/simulator.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjSANHRgABMXPfm-qJQKoy2b25JmLh19k",
  authDomain: "formula-d-planner.firebaseapp.com",
  projectId: "formula-d-planner",
  storageBucket: "formula-d-planner.appspot.com",
  messagingSenderId: "507660343472",
  appId: "1:507660343472:web:b8637152df0396a92ec375",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const seasonYear = 2026;
const raceId = "2026-2026-W18";

const raceRef = doc(db, "simuf1Races", raceId);
const raceSnap = await getDoc(raceRef);
if (!raceSnap.exists()) {
  throw new Error(`Course introuvable: ${raceId}`);
}

const race = raceSnap.data();
const weekKey = String(race.weekKey || "");

const entriesSnap = await getDocs(collection(db, "simuf1Races", raceId, "entries"));
const entries = entriesSnap.docs.map((d) => d.data());

const result = simulateRaceFromEntries(raceId, seasonYear, entries, weekKey);

await setDoc(doc(db, "simuf1Races", raceId, "results", "latest"), {
  ...result,
  generatedAt: serverTimestamp(),
}, { merge: true });

await setDoc(raceRef, {
  status: "published",
  updatedAt: serverTimestamp(),
}, { merge: true });

const raceDocs = await getDocs(collection(db, "simuf1Races"));
const races = raceDocs.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((r) => Number(r.seasonYear || 0) === seasonYear);

const teams = {};
const drivers = {};

for (const r of races) {
  const resultSnap = await getDoc(doc(db, "simuf1Races", String(r.id), "results", "latest"));
  if (!resultSnap.exists()) continue;
  const rs = resultSnap.data();
  for (const car of rs.cars || []) {
    teams[car.teamName] = (teams[car.teamName] || 0) + Number(car.points || 0);
    drivers[car.pilotName] = (drivers[car.pilotName] || 0) + Number(car.points || 0);
  }
}

await setDoc(doc(db, "simuf1Seasons", String(seasonYear)), {
  seasonYear,
  teams,
  drivers,
  updatedAt: serverTimestamp(),
}, { merge: true });

console.log(JSON.stringify({
  raceId,
  weekKey,
  entries: entries.length,
  resultCars: Array.isArray(result.cars) ? result.cars.length : 0,
  resultDiceLogs: Array.isArray(result.diceLogs) ? result.diceLogs.length : 0,
  teamsCount: Object.keys(teams).length,
  driversCount: Object.keys(drivers).length,
}, null, 2));
