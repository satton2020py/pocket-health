import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  Timestamp,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import type { WeightEntry } from './weight';

function weightsCollection(uid: string) {
  return collection(doc(collection(getFirestore(), 'users'), uid), 'weights');
}

export async function saveWeight(uid: string, kg: number): Promise<void> {
  await addDoc(weightsCollection(uid), {
    kg,
    recordedAt: Timestamp.fromDate(new Date()),
  });
}

export async function loadWeights(uid: string): Promise<WeightEntry[]> {
  const snap = await getDocs(
    query(weightsCollection(uid), orderBy('recordedAt', 'desc')),
  );
  return snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      kg: data.kg as number,
      recordedAt: (data.recordedAt as Timestamp).toDate(),
    };
  });
}
