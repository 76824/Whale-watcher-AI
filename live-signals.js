const signalsContainer = document.getElementById('live-signals');

async function loadSignals() {
  try {
    const outerSnapshot = await db.collection('Whale_signals').get();

    if (outerSnapshot.empty) {
      signalsContainer.innerHTML = '<p>No signals available (outer collection is empty).</p>';
      return;
    }

    let latestSignal = null;
    let latestTime = 0;

    for (const outerDoc of outerSnapshot.docs) {
      const subSnapshot = await db
        .collection(Whale_signals/${outerDoc.id}/signals)
        .get();

      subSnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = new Date(data.time).getTime();

        if (!isNaN(timestamp) && timestamp > latestTime) {
          latestTime = timestamp;
          latestSignal = data;
        }
      });
    }

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

loadSignals();
