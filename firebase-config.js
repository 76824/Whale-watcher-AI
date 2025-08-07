// firebase-config.js
// ✅ Using Firebase from CDN, no need to import anything

const firebaseConfig = {
  apiKey: "AIzaSyDmE1r3WUN1RTufZMaphHR1rPCgBAgwsFHM",
  authDomain: "project-7459169556796997288.firebaseapp.com",
  projectId: "project-7459169556796997288",
  storageBucket: "project-7459169556796997288.appspot.com",
  messagingSenderId: "112926280045",
  appId: "1:112926280045:web:81aece7b7d8d41265375264"
};

// ✅ Initialize Firebase and Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
