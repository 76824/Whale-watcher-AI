import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Load whale signals
async function loadWhaleSignals() {
  try {
    const signalsContainer = document.getElementById('live-signals');
    signalsContainer.innerHTML = ''; // Clear previous signals

    const querySnapshot = await getDocs(collection(db, 'whale_signals'));

    if (querySnapshot.empty) {
      signalsContainer.innerHTML = '<p>No whale signals found.</p>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      console.log("📡 Loaded data:", data); // Debug log

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
    console.error('🔥 Error fetching whale signals:', error);
    document.getElementById('live-signals').innerHTML = '<p>Error loading signals.</p>';
  }
}

// Run it
loadWhaleSignals();
