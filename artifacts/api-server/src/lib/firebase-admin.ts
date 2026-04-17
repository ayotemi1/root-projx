import {
  initializeApp,
  getApps,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { logger } from "./logger.js";

let firebaseApp: App | undefined;

function initFirebaseAdmin(): App | undefined {
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!projectId) {
    logger.warn("FIREBASE_PROJECT_ID is not set — Firebase Admin will not initialise");
    return undefined;
  }

  firebaseApp = initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });

  logger.info({ projectId }, "Firebase Admin SDK initialised");
  return firebaseApp;
}

initFirebaseAdmin();

export const adminDb = () => getFirestore();
export const adminAuth = () => getAuth();
export const adminStorage = () => getStorage();
