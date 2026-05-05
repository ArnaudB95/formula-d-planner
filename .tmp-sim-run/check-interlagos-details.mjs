import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

const raceId = "2026-2026-W18";
const raceSnap = await getDoc(doc(db, "simuf1Races", raceId));
const resultSnap = await getDoc(doc(db, "simuf1Races", raceId, "results", "latest"));
const seasonSnap = await getDoc(doc(db, "simuf1Seasons", "2026"));

const race = raceSnap.exists() ? raceSnap.data() : null;
const result = resultSnap.exists() ? resultSnap.data() : null;
const season = seasonSnap.exists() ? seasonSnap.data() : null;

console.log(JSON.stringify({
  raceExists: raceSnap.exists(),
  raceStatus: race?.status ?? null,
  raceSunday: race?.sundayDateISO ?? null,
  resultExists: resultSnap.exists(),
  carsCount: Array.isArray(result?.cars) ? result.cars.length : 0,
  diceLogsCount: Array.isArray(result?.diceLogs) ? result.diceLogs.length : 0,
  generatedAtISO: result?.generatedAtISO ?? null,
  seasonExists: seasonSnap.exists(),
  driversCount: season?.drivers ? Object.keys(season.drivers).length : 0,
  teamsCount: season?.teams ? Object.keys(season.teams).length : 0
}, null, 2));
