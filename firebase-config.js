// ✅ Correctly reference global 'firebase' from CDN — no import/export

const firebaseConfig = {
  apiKey: "AIzaSyDmE1r3WUNlRTufZMaphHRiPCgBAgwsFHM",
  authDomain: "project-7459169556796997288.firebaseapp.com",
  projectId: "project-7459169556796997288",
  storageBucket: "project-7459169556796997288.appspot.com",
  messagingSenderId: "112926280045",
  appId: "1:112926280045:web:iaece7b7d8d41265375264"
};

// ✅ Initialize Firebase and Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
