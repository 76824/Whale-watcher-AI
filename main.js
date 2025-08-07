// main.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const signalsRef = collection(db, 'signals');
const q = query(signalsRef, orderBy('timestamp', 'desc'));

const signalList = document.getElementById('signalList');

onSnapshot(q, (snapshot) => {
  signalList.innerHTML = '';
  snapshot.forEach((doc) => {
    const signal = doc.data();
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${signal.coin}</strong> - ${signal.signalType} <br>
      Confidence: ${signal.confidence}%<br>
      Price: $${signal.price}<br>
      Whale Flow: ${signal.whaleFlow} <br>
      Bot Activity: ${signal.botActivity} <br>
      Time: ${new Date(signal.timestamp?.toDate()).toLocaleString()}
    `;
    signalList.appendChild(li);
  });
});
