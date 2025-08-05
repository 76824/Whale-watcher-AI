import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "./firebase-config.js";

// Initialize Firestore
const db = getFirestore(app);

// Reference to whale_signals collection
const signalsRef = collection(db, "whale_signals");

// Target container
const liveSignalsDiv = document.getElementById("live-signals");

// Fetch and display signals
async function loadSignals() {
  try {
    const querySnapshot = await getDocs(signalsRef);
    liveSignalsDiv.innerHTML = ""; // Clear placeholder

    if (querySnapshot.empty) {
      liveSignalsDiv.innerHTML = "<p>No signals yet. Chenda is listening...</p>";
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const signalHTML = `
        <div class="signal-card">
          <p><strong>Action:</strong> ${data.action}</p>
          <p><strong>Coin:</strong> ${data.coin}</p>
          <p><strong>Confidence:</strong> ${data.confidence}</p>
          <p><strong>Explanation:</strong> ${data.explanation}</p>
          <p><strong>Time:</strong> ${data.time.toDate().toLocaleString()}</p>
        </div>
        <hr />
      `;
      liveSignalsDiv.innerHTML += signalHTML;
    });
  } catch (error) {
    console.error("Error loading signals:", error);
    liveSignalsDiv.innerHTML = "<p>⚠ Failed to load signals. Please try again later.</p>";
  }
}

loadSignals();
