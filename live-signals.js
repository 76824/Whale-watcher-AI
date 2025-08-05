// live-signals.js
import { db } from './firebase-config.js';
import { collection, getDocs } from 'firebase/firestore';

// Reference to the DOM container
const signalsContainer = document.getElementById('live-signals');

// Async function to load and display signals
async function loadSignals() {
  try {
    // Step 1: Reference the outer collection "Whale_signals"
    const outerCollection = collection(db, 'Whale_signals');
    const outerSnapshot = await getDocs(outerCollection);

    if (outerSnapshot.empty) {
      signalsContainer.innerHTML = '<p>No signals available (outer collection is empty).</p>';
      return;
    }

    let latestSignal = null;
    let latestTime = 0;

    // Step 2: Loop through documents in Whale_signals
    for (const outerDoc of outerSnapshot.docs) {
      const signalsSub = collection(db, Whale_signals/${outerDoc.id}/signals);
      const subSnapshot = await getDocs(signalsSub);

      subSnapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = new Date(data.time).getTime();

        if (!isNaN(timestamp) && timestamp > latestTime) {
          latestTime = timestamp;
          latestSignal = data;
        }
      });
    }

    // Step 3: Render result or error message
    if (latestSignal) {
      signalsContainer.innerHTML = `
        <div class="signal-box">
          <h3>📈 ${latestSignal.action} Signal for ${latestSignal.coin}</h3>
          <p><strong>Confidence:</strong> ${latestSignal.confidence}</p>
          <p><strong>Reason:</strong> ${latestSignal.explanation}</p>
          <p><strong>Time:</strong> ${latestSignal.time}</p>
        </div>
      `;
    } else {
      signalsContainer.innerHTML = '<p>No recent signals found in any subcollection.</p>';
    }

  } catch (error) {
    console.error("❌ Error loading signals:", error);
    signalsContainer.innerHTML = '<p>Error loading signals. Please check console for details.</p>';
  }
}

// Run on page load
loadSignals();
