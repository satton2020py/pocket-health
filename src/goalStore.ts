import {
  collection,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';

export type SavedGoals = {
  goalKg: number | null;
  stepGoal: number;
};

// Stored at users/{uid}/settings/goals, so it follows the Google account.
function goalsDoc(uid: string) {
  const settings = collection(doc(collection(getFirestore(), 'users'), uid), 'settings');
  return doc(settings, 'goals');
}

export async function loadGoals(uid: string): Promise<SavedGoals | null> {
  const snap = await getDoc(goalsDoc(uid));
  if (!snap.exists()) return null;
  const data = snap.data() ?? {};
  return {
    goalKg: typeof data.goalKg === 'number' ? data.goalKg : null,
    stepGoal: typeof data.stepGoal === 'number' ? data.stepGoal : 8000,
  };
}

export async function saveGoals(uid: string, goals: SavedGoals): Promise<void> {
  await setDoc(goalsDoc(uid), goals, { merge: true });
}
