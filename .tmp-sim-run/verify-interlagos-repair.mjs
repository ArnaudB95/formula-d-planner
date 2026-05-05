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
const resultSnap = await getDoc(doc(db, "simuf1Races", raceId, "results", "latest"));
const seasonSnap = await getDoc(doc(db, "simuf1Seasons", "2026"));

const result = resultSnap.data();
const season = seasonSnap.data();

const topCars = (result?.cars || []).slice(0, 3).map((c) => ({ pos: c.position, pilot: c.pilotName, team: c.teamName, pts: c.points }));
const firstLogs = (result?.diceLogs || []).slice(0, 5).map((l) => ({ seq: l.seq, phase: l.phase, stat: l.stat, summary: l.summary }));

console.log(JSON.stringify({
  resultCars: (result?.cars || []).length,
  diceLogs: (result?.diceLogs || []).length,
  topCars,
  seasonTeams: season?.teams || {},
  seasonDriversCount: season?.drivers ? Object.keys(season.drivers).length : 0,
  firstLogs,
}, null, 2));
