// Firebase configuration and initialization (CDN version)
const firebaseConfig = {
  apiKey: "AIzaSyDmE1r3WUNlRTufZMaphHRiPCgBAgwsFHM",
  authDomain: "project-7459169556796997288.firebaseapp.com",
  projectId: "project-7459169556796997288",
  storageBucket: "project-7459169556796997288.appspot.com",
  messagingSenderId: "112926280045",
  appId: "1:112926280045:web:iaece7b7d8d41265375264"
};

// Initialize Firebase and Firestore using global firebase object
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
