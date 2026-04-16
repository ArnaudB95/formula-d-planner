import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth as getFirebaseAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore as getFirebaseFirestore } from "firebase/firestore";
import { getStorage as getFirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDjSANHRgABMXPfm-qQKoy2b25JmLh19k",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "formula-d-planner.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "formula-d-planner",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "formula-d-planner.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "507660343472",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:507660343472:web:b8637152df0396a92ec375",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-T4W4TXWPYE",
};

const isFirebaseConfigValid =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.authDomain &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.storageBucket &&
  !!firebaseConfig.messagingSenderId &&
  !!firebaseConfig.appId;

let firebaseApp: any = null;
let authInstance: any = null;
let providerInstance: any = null;
let dbInstance: any = null;
let storageInstance: any = null;

const ensureFirebaseClient = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!isFirebaseConfigValid) {
    return null;
  }

  if (!firebaseApp) {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  return firebaseApp;
};

export const getAuth = () => {
  const app = ensureFirebaseClient();
  if (!app) return null;

  if (!authInstance) {
    authInstance = getFirebaseAuth(app);
  }

  return authInstance;
};

export const getProvider = () => {
  if (!providerInstance) {
    providerInstance = new GoogleAuthProvider();
  }

  return providerInstance;
};

export const getFirestore = () => {
  const app = ensureFirebaseClient();
  if (!app) return null;

  if (!dbInstance) {
    dbInstance = getFirebaseFirestore(app);
  }

  return dbInstance;
};

export const getStorage = () => {
  const app = ensureFirebaseClient();
  if (!app) return null;

  if (!storageInstance) {
    storageInstance = getFirebaseStorage(app);
  }

  return storageInstance;
};
