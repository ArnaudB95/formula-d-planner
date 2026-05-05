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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const raceId = "2026-2026-W18";
const entriesSnap = await getDocs(collection(db, "simuf1Races", raceId, "entries"));
const rows = entriesSnap.docs.map((d) => d.data());
const participating = rows.filter((r) => r?.participating !== false);
console.log(JSON.stringify({ totalEntries: rows.length, participatingEntries: participating.length, sample: rows.slice(0, 3).map((e) => ({ teamName: e.teamName, participating: e.participating, cars: Array.isArray(e.cars) ? e.cars.length : 0 })) }, null, 2));
