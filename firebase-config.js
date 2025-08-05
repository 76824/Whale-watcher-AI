// firebase-config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ✅ Your actual Firebase configuration:
const firebaseConfig = {
  apiKey: "AIzaSyDmElr3wUNlRTufZMaphHRiPCgBAgwsFHM",
  authDomain: "project-7459169556796997288.firebaseapp.com",
  projectId: "project-7459169556796997288",
  storageBucket: "project-7459169556796997288.appspot.com",
  messagingSenderId: "112926280045",
  appId: "1:112926280045:web:1aeec7b78d8d41263573264"
};

// 🔥 Initialize Firebase and Firestore:
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
