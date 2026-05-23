import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

let serverApp: App | null = null;
let serverDb: Firestore | null = null;

const readServiceAccountFromEnv = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ServiceAccountShape;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
};

const readServiceAccountFromSplitVars = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
};

const ensureServerApp = () => {
  if (serverApp) return serverApp;
  if (getApps().length > 0) {
    serverApp = getApps()[0]!;
    return serverApp;
  }

  const serviceAccount = readServiceAccountFromEnv() || readServiceAccountFromSplitVars();
  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin credentials missing. Configure FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
    );
  }

  serverApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });

  return serverApp;
};

export const getServerFirestore = () => {
  if (!serverDb) {
    serverDb = getFirestore(ensureServerApp());
  }
  return serverDb;
};

export const serverTimestamp = () => FieldValue.serverTimestamp();
