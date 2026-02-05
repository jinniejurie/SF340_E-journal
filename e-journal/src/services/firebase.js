// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Guarded initialization: avoid throwing when environment variables are missing
// Required minimal values for many Firebase features are apiKey, projectId and appId.
const hasMinimalConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app = null;
let analytics = null;

if (hasMinimalConfig) {
  try {
    app = initializeApp(firebaseConfig);
    try {
      // analytics can fail in some environments (SSR, missing browser APIs)
      analytics = getAnalytics(app);
    } catch (e) {
      // Don't block the app if analytics can't initialize
      // eslint-disable-next-line no-console
      console.warn('Firebase analytics not available:', e?.message || e);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Firebase app:', e?.message || e);
    app = null;
  }
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Firebase configuration incomplete. Skipping initialization.\n' +
      'Create a .env file with VITE_API_KEY, VITE_AUTH_DOMAIN, VITE_PROJECT_ID, VITE_APP_ID, etc.,\n' +
      'then restart the dev server.'
  );
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
