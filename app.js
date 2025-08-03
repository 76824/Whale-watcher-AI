import { db } from './firebase-config.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

const signalContainer = document.getElementById('live-signals');

const signalsRef = collection(db, 'whaleSignals');

onSnapshot(signalsRef, (snapshot) => {
  signalContainer.innerHTML = ''; // Clear old signals
  snapshot.forEach((doc) => {
    const data = doc.data();
    const signalEl = document.createElement('div');
    signalEl.className = 'signal-box';
    signalEl.innerHTML = `
      <strong>${data.coin}</strong> - ${data.action} <br>
      Price: ${data.price} | Volume: ${data.volume} <br>
      Reason: ${data.reason} | Time: ${data.timestamp}
    `;
    signalContainer.appendChild(signalEl);
  });
});
