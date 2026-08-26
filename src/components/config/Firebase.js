import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBFGWRLolpvnlrK-fpqtiCAvdual07mzDM",
  authDomain: "aquallera.firebaseapp.com",
  databaseURL: "https://aquallera-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aquallera",
  // storageBucket: "aquallera.firebasestorage.app", used when firebase plan is upgraded
  messagingSenderId: "432017337394",
  appId: "1:432017337394:web:f62e953b995675cbaa602b"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
setPersistence(auth, browserSessionPersistence);
const database = getDatabase(
  app,
  "https://aquallera-default-rtdb.asia-southeast1.firebasedatabase.app"
);

// const storage = getStorage(app); used when firebase plan is upgraded

//export { auth, database, storage }; used when firebase plan is upgraded
export { auth, database };
export default app;