// live-signals.js

import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

async function fetchWhaleSignals() {
  try {
    const signalsContainer = document.getElementById('live-signals');
    signalsContainer.innerHTML = ''; // Clear previous content

    const querySnapshot = await getDocs(collection(db, 'whale_signals'));

    if (querySnapshot.empty) {
      signalsContainer.innerHTML = '<p>No whale signals found.</p>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const signalElement = document.createElement('div');
      signalElement.classList.add('signal');

      signalElement.innerHTML = `
        <h3>🐳 ${data.action} ${data.coin}</h3>
        <p><strong>Confidence:</strong> ${data.confidence}</p>
        <p><strong>Explanation:</strong> ${data.explanation}</p>
        <p><strong>Time:</strong> ${new Date(data.time.seconds * 1000).toLocaleString()}</p>
      `;

      signalsContainer.appendChild(signalElement);
    });
  } catch (error) {
    console.error('Error fetching whale signals:', error);
    document.getElementById('live-signals').innerHTML = '<p>Error loading signals.</p>';
  }
}

fetchWhaleSignals();
