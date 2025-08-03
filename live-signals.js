import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collectionGroup, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const LiveSignals = () => {
  const [signal, setSignal] = useState(null);

  useEffect(() => {
    const q = query(
      collectionGroup(db, 'signals'), // Search all signals collections, regardless of parent
      orderBy('time', 'desc'), // Sort by timestamp
      limit(1) // Get only the latest one
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const latestSignal = querySnapshot.docs[0].data();
        setSignal(latestSignal);
      } else {
        setSignal(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ color: 'white', marginTop: '30px' }}>
      {signal ? (
        <>
          <h2>{signal.coin} ▶ {signal.action}</h2>
          <p><strong>{signal.time?.toDate().toLocaleString() ?? "No time"}</strong></p>
          <p>{signal.explanation}</p>
        </>
      ) : (
        <p>🐋 No live signal at the moment… Chenda’s still watching!</p>
      )}
    </div>
  );
};

export default LiveSignals;
