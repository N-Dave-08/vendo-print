import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGoFNIbWJ9OiTzMc46rSnoMvxNG2CcCyc",
  authDomain: "ezprint-4258e.firebaseapp.com",
  databaseURL: "https://ezprint-4258e-default-rtdb.firebaseio.com",
  projectId: "ezprint-4258e",
  storageBucket: "ezprint-4258e.firebasestorage.app",
  messagingSenderId: "602784580883",
  appId: "1:602784580883:web:a1f6de33f9ecaa671186e6",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const realtimeDb = getDatabase(firebaseApp);
const storage = getStorage(firebaseApp);
export const db = getFirestore(firebaseApp);
export {realtimeDb, storage};
