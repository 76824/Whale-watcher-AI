import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

const LiveSignals = () => {
  const [latestSignal, setLatestSignal] = useState(null);

  useEffect(() => {
    // Correct nested path to whale_signals > [docID] > signals
    const q = query(
      collection(db, "whale_signals", "OgGtHZbcGnBHW9N6Gr9k", "signals"),
      orderBy("time", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const signalData = querySnapshot.docs[0].data();
        setLatestSignal(signalData);
      } else {
        setLatestSignal(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ color: "gold", textAlign: "center", paddingTop: "20px" }}>
      {latestSignal ? (
        <>
          <h2>
            {latestSignal.coin} ➤ {latestSignal.action}
          </h2>
          <p>{latestSignal.explanation}</p>
          <p>
            Confidence: {latestSignal.confidence} <br />
            Time: {new Date(latestSignal.time.seconds * 1000).toLocaleString()}
          </p>
        </>
      ) : (
        <p>No recent signals found.</p>
      )}
    </div>
  );
};

export default LiveSignals;
