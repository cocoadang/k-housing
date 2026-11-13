import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  setLogLevel,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Suppress benign gRPC idle stream disconnect warnings
try {
  setLogLevel('error');
} catch (e) {
  // ignore
}

let firestoreInstance: Firestore | null = null;
let firestoreInitialized = false;
let firestoreAvailable = false;

/**
 * Initializes and returns the server-side Firebase Firestore instance.
 * Uses configuration provided in firebase-applet-config.json.
 */
export function getFirestoreDb(): Firestore | null {
  if (process.env.DISABLE_FIRESTORE === 'true') return null;
  if (firestoreInitialized) {
    return firestoreInstance;
  }

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!process.env.FIREBASE_CONFIG_JSON && !fs.existsSync(configPath)) {
      console.warn('[Firestore] firebase-applet-config.json not found. Firestore will be disabled.');
      firestoreInitialized = true;
      firestoreAvailable = false;
      return null;
    }

    const config = JSON.parse(process.env.FIREBASE_CONFIG_JSON || fs.readFileSync(configPath, 'utf8'));
    if (!config.apiKey || !config.projectId) {
      console.warn('[Firestore] Invalid firebase-applet-config.json. Missing apiKey or projectId.');
      firestoreInitialized = true;
      firestoreAvailable = false;
      return null;
    }

    const app =
      getApps().length === 0
        ? initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          })
        : getApp();

    const databaseId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
      ? config.firestoreDatabaseId
      : undefined;

    firestoreInstance = initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      databaseId
    );

    firestoreInitialized = true;
    firestoreAvailable = true;
    console.log(`[Firestore] Initialized client (project: ${config.projectId}, db: ${databaseId || '(default)'})`);
  } catch (err: any) {
    console.error('[Firestore] Initialization failed, falling back to direct MOLIT API:', err?.message || err);
    firestoreInstance = null;
    firestoreInitialized = true;
    firestoreAvailable = false;
  }

  return firestoreInstance;
}

export function isFirestoreAvailable(): boolean {
  if (!firestoreInitialized) {
    getFirestoreDb();
  }
  return firestoreAvailable && firestoreInstance !== null;
}
