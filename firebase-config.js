// firebase-config.js (ES module, Firebase v10 CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  "apiKey": "AIzaSyDmE1r3WUN1RTufZMaphHR1PCgBAgwsFHM",
  "authDomain": "project-7459169556796997288.firebaseapp.com",
  "projectId": "project-7459169556796997288",
  "storageBucket": "project-7459169556796997288.appspot.com",
  "messagingSenderId": "112926280045",
  "appId": "1:112926280045:web:8b09aac357309a16537264"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
