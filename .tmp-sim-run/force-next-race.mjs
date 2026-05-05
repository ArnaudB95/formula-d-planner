import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

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

const currentId = "2026-2026-W18";
const nextId = "2026-2026-W19";

const currentSnap = await getDoc(doc(db, "simuf1Races", currentId));
const currentStatus = currentSnap.exists() ? String(currentSnap.data().status || "unknown") : "missing";

const nextRef = doc(db, "simuf1Races", nextId);
const nextSnap = await getDoc(nextRef);
if (!nextSnap.exists()) {
  await setDoc(nextRef, {
    id: nextId,
    seasonYear: 2026,
    weekKey: "2026-W19",
    sundayDateISO: "2026-05-10",
    circuitName: "Mexico City",
    circuitProfile: "Rapide",
    boostedStats: ["bloc", "audace"],
    penalizedStats: ["endurance"],
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

const afterNextSnap = await getDoc(nextRef);
console.log(JSON.stringify({
  currentRaceId: currentId,
  currentStatus,
  simulationExecutedNow: currentStatus !== "published",
  nextRaceId: nextId,
  nextExists: afterNextSnap.exists(),
  nextStatus: afterNextSnap.exists() ? String(afterNextSnap.data().status || "open") : "missing",
  nextSundayDateISO: afterNextSnap.exists() ? String(afterNextSnap.data().sundayDateISO || "") : "",
  nextCircuitName: afterNextSnap.exists() ? String(afterNextSnap.data().circuitName || "") : "",
}));
