import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import type { WeightEntry } from './weight';

function weightsCollection(uid: string) {
  return collection(doc(collection(getFirestore(), 'users'), uid), 'weights');
}

// Saves one weight. `recordedAt` keeps the original time when phone records move to the cloud.
export async function saveWeight(uid: string, kg: number, recordedAt: Date = new Date()): Promise<void> {
  await addDoc(weightsCollection(uid), {
    kg,
    recordedAt: Timestamp.fromDate(recordedAt),
  });
}

export async function updateWeight(uid: string, id: string, kg: number, recordedAt: Date): Promise<void> {
  await updateDoc(doc(weightsCollection(uid), id), {
    kg,
    recordedAt: Timestamp.fromDate(recordedAt),
  });
}

export async function deleteWeight(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(weightsCollection(uid), id));
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
