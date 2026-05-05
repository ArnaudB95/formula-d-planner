import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDjSANHRgABMXPfm-qJQKoy2b25JmLh19k",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "formula-d-planner.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "formula-d-planner",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "formula-d-planner.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "507660343472",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:507660343472:web:b8637152df0396a92ec375",
};

let serverApp: ReturnType<typeof initializeApp> | null = null;
let serverDb: ReturnType<typeof getFirestore> | null = null;

export const getServerFirestore = () => {
  if (!serverApp) {
    serverApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  if (!serverDb) {
    serverDb = getFirestore(serverApp);
  }

  return serverDb;
};
