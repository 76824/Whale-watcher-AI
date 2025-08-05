import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

export default function LiveSignals() {
  const [latestSignal, setLatestSignal] = useState(null);

  useEffect(() => {
    const signalsRef = collection(
      db,
      "whale_signals",
      "L5WMFMwFpZw5uj71bnSs", // ✅ Updated document ID
      "signals"
    );

    const q = query(signalsRef, orderBy("time", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const signalData = snapshot.docs[0].data();
        setLatestSignal(signalData);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6 bg-black text-white rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-yellow-400">
        📡 Latest Whale Signal
      </h2>
      {latestSignal ? (
        <div className="space-y-2">
          <p>
            <strong>📈 Action:</strong> {latestSignal.action}
          </p>
          <p>
            <strong>🪙 Coin:</strong> {latestSignal.coin}
          </p>
          <p>
            <strong>🤖 Confidence:</strong> {latestSignal.confidence}
          </p>
          <p>
            <strong>💬 Explanation:</strong> {latestSignal.explanation}
          </p>
          <p>
            <strong>🕒 Time:</strong>{" "}
            {new Date(latestSignal.time.seconds * 1000).toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="text-gray-400">No live signals yet...</p>
      )}
    </div>
  );
}
