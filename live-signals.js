import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function LiveSignals() {
  const [latestSignal, setLatestSignal] = useState(null);

  useEffect(() => {
    const docRef = collection(db, 'whale_signals', 'eUeijp0pE22VSzkqC5V1', 'signals');
    const q = query(docRef, orderBy('time', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setLatestSignal(doc.data());
      }
    });

    return () => unsubscribe();
  }, []);

  if (!latestSignal) return <div>Loading signal...</div>;

  return (
    <div className="text-yellow-300 p-4 text-xl">
      <strong>{latestSignal.coin}</strong> ► {latestSignal.action}
      <br />
      Confidence: <em>{latestSignal.confidence}</em>
      <br />
      {latestSignal.explanation}
      <br />
      <span className="text-sm text-white">
        {latestSignal.time?.toDate().toLocaleString()}
      </span>
    </div>
  );
}
