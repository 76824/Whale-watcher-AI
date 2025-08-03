import { db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const signalsRef = collection(db, "signals");
const latestSignalQuery = query(signalsRef, orderBy("time", "desc"), limit(1));

const liveSignalsDiv = document.getElementById("live-signals");

onSnapshot(latestSignalQuery, (snapshot) => {
  liveSignalsDiv.innerHTML = "";
  snapshot.forEach((doc) => {
    const data = doc.data();
    const content = `
      <div>
        <strong>${data.coin} ➤ ${data.action}</strong><br>
        ${data.explanation}<br>
        ${formatTimestamp(data.time)}
      </div>
    `;
    liveSignalsDiv.innerHTML += content;
  });
});

function formatTimestamp(timestamp) {
  if (!timestamp || !timestamp.toDate) return "Invalid date";
  const date = timestamp.toDate();
  return date.toISOString().split("T")[0] + " " + date.toTimeString().split(" ")[0];
}
