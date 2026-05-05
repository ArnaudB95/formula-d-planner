import fs from "node:fs";
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
if (!resultSnap.exists()) throw new Error("Resultat introuvable");

const result = resultSnap.data();
const logs = Array.isArray(result.diceLogs) ? [...result.diceLogs].sort((a, b) => a.seq - b.seq) : [];
const cars = Array.isArray(result.cars) ? result.cars : [];

const lines = [];
lines.push(`RAPPORT COMPLET SIMUF1 - ${raceId}`);
lines.push(`Date generation: ${result.generatedAtISO || new Date().toISOString()}`);
lines.push("");
lines.push("CLASSEMENT COURSE:");
for (const car of cars) {
  lines.push(`P${car.position} | ${car.pilotName} | ${car.teamName} | ${car.points} pts${car.dnf ? ` | DNF T${car.dnfLap}` : ""}`);
}
lines.push("");
lines.push("LOGS COMPLETS (ordre chronologique):");
for (const log of logs) {
  const head = `#${log.seq} | ${String(log.phase).toUpperCase()}${log.lap ? ` | T${log.lap}` : ""} | ${String(log.stat).toUpperCase()}`;
  const dice = `roll=${log.roll ?? "-"} threshold=${log.threshold ?? "-"} success=${log.success ? "Y" : "N"}`;
  lines.push(`${head} | ${dice} | ${log.summary}`);
}

const outPath = "simuf1_rapport_interlagos_2026-05-03_logs_complets.txt";
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(JSON.stringify({ outPath, lines: lines.length, logs: logs.length, cars: cars.length }, null, 2));
