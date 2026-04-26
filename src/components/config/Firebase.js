import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFGWRLolpvnlrK-fpqtiCAvdual07mzDM",
  authDomain: "aquallera.firebaseapp.com",
  databaseURL: "https://aquallera-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aquallera",
  // storageBucket: "aquallera.firebasestorage.app", used when firebase plan is upgraded
  messagingSenderId: "432017337394",
  appId: "1:432017337394:web:f62e953b995675cbaa602b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const database = getDatabase(
  app,
  "https://aquallera-default-rtdb.asia-southeast1.firebasedatabase.app"
);

// const storage = getStorage(app); used when firebase plan is upgraded

// Export all services together
//export { auth, database, storage }; used when firebase plan is upgraded
export { auth, database };
export default app;