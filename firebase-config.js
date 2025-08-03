// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDmE1r3JWUNIRtUfZMaphHriPCgbAgwsFHM",
  authDomain: "project-7459169556796997288.firebaseapp.com",
  projectId: "project-7459169556796997288",
  storageBucket: "project-7459169556796997288.appspot.com",
  messagingSenderId: "112926200845",
  appId: "1:112926200845:web:aeec7b7d8d41216f357264"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
