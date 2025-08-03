// live-signals.js

import { db } from "./firebase-config.js";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const signalsContainer = document.getElementById("live-signals");

const q = query(collection(db, "whale_signals"), orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
  signalsContainer.innerHTML = ""; // Clear existing signals

  snapshot.forEach((doc) => {
    const data = doc.data();
    const signalEl = document.createElement("div");
    signalEl.innerHTML = `
      <p><strong>${data.coin}</strong> ➤ <span style="color:${
        data.signal === "BUY" ? "green" : data.signal === "SELL" ? "red" : "orange"
      }">${data.signal}</span><br><em>${data.explanation}</em><br><small>${new Date(
      data.timestamp.seconds * 1000
    ).toLocaleString()}</small></p><hr>`;
    signalsContainer.appendChild(signalEl);
  });
});
