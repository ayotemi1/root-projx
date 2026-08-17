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

/**
 * Upload a file to Firebase Storage using the Admin SDK.
 * Bypasses all Firebase Storage security rules — safe to call from trusted server code.
 * Returns a permanent download URL (same format as the Firebase Console "Download URL").
 */
export async function adminUploadFile(
  filePath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket();
  const file = bucket.file(filePath);

  // Generate a stable download token so the URL format matches the Firebase Console
  // URL (firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}).
  // This token is permanent and survives re-uploads to the same path.
  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    contentType: mimeType,
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
    },
  });

  const bucketName = bucket.name;
  const encodedPath = encodeURIComponent(filePath);
  return (
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}` +
    `/o/${encodedPath}?alt=media&token=${downloadToken}`
  );
}
