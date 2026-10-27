import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET, // used when firebase plan is upgraded
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Create React App inlines REACT_APP_* values at build time, so a missing
// variable arrives here as undefined instead of failing the build. Validate
// the inlined config object directly (a dynamic process.env[name] lookup
// would never be replaced by CRA and would always be undefined).
const requiredFirebaseConfig = {
  REACT_APP_FIREBASE_API_KEY: firebaseConfig.apiKey,
  REACT_APP_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  REACT_APP_FIREBASE_DATABASE_URL: firebaseConfig.databaseURL,
  REACT_APP_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  REACT_APP_FIREBASE_APP_ID: firebaseConfig.appId,
};

const missingFirebaseConfig = Object.entries(requiredFirebaseConfig)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingFirebaseConfig.length > 0) {
  const message =
    `[Firebase] Missing required environment variables:\n  - ${missingFirebaseConfig.join("\n  - ")}\n` +
    "Copy .env.example to .env and fill in the values locally, or add them in " +
    "Vercel -> Settings -> Environment Variables (Production + Preview) and redeploy.";

  console.error(message);

  if (process.env.NODE_ENV !== "production") {
    throw new Error(message);
  }
}

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
setPersistence(auth, browserSessionPersistence);
const database = getDatabase(
  app,
  process.env.REACT_APP_FIREBASE_DATABASE_URL,
);

// const storage = getStorage(app); used when firebase plan is upgraded

//export { auth, database, storage }; used when firebase plan is upgraded
export { auth, database };
export default app;
