import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDjSANHRgABMXPfm-qJQKoy2b25JmLh19k",
  authDomain: "formula-d-planner.firebaseapp.com",
  projectId: "formula-d-planner",
  storageBucket: "formula-d-planner.appspot.com",
  messagingSenderId: "507660343472",
  appId: "1:507660343472:web:b8637152df0396a92ec375",
};

const budget = (car) => car.bloc + car.grip + car.audace + car.defense + car.endurance + car.pneus + car.pitStops;
const valid = (car) => {
  const stats = [car.bloc, car.grip, car.audace, car.defense, car.endurance, car.pneus];
  const statsInRange = stats.every((v) => v >= 1 && v <= 10);
  const pitStopsOk = car.pitStops >= 0 && car.pitStops <= 3;
  const pitLapsOk = car.pitLaps.length === car.pitStops && car.pitLaps.every((lap) => lap >= 1 && lap <= 9);
  const pitLapsStrictOrder = car.pitLaps.every((lap, i) => i === 0 || car.pitLaps[i - 1] < lap);
  return statsInRange && pitStopsOk && pitLapsOk && pitLapsStrictOrder && budget(car) === 31;
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const raceId = "2026-2026-W18";
const entriesSnap = await getDocs(collection(db, "simuf1Races", raceId, "entries"));
const rows = entriesSnap.docs.map((d) => d.data());

const report = rows.map((entry) => ({
  teamName: entry.teamName,
  participating: entry.participating,
  cars: (entry.cars || []).map((c) => ({
    pilotName: c.pilotName,
    budget: budget(c),
    valid: valid(c),
    pitStops: c.pitStops,
    pitLaps: c.pitLaps,
    stats: { bloc: c.bloc, grip: c.grip, audace: c.audace, defense: c.defense, endurance: c.endurance, pneus: c.pneus }
  }))
}));

console.log(JSON.stringify(report, null, 2));
