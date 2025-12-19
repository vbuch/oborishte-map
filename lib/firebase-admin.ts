import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;

// Initialize Firebase Admin SDK
if (!getApps().length) {
  // For production, use service account key from environment
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );

      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } catch (error) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error);
      throw new Error(
        "Failed to initialize Firebase Admin SDK: Invalid service account JSON"
      );
    }
  } else {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found!"
    );
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required. " +
        "Please add your Firebase service account JSON to .env.local"
    );
  }

  adminDb = getFirestore(adminApp);
  adminAuth = getAuth(adminApp);
} else {
  adminApp = getApps()[0];
  adminDb = getFirestore(adminApp);
  adminAuth = getAuth(adminApp);
}

export { adminApp, adminDb, adminAuth };
