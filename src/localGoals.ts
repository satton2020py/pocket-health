import AsyncStorage from '@react-native-async-storage/async-storage';

// Target weight and step goal kept on the phone while signed out.
const KEY = 'goals.local.v1';

// sleepGoal and heightCm may be missing in goals saved by an older version.
export type LocalGoals = {
  goalKg: number | null;
  stepGoal: number;
  sleepGoal?: number;
  heightCm?: number | null;
};

// Any read or write failure is treated as "nothing saved" so the app keeps working.
export async function loadLocalGoals(): Promise<LocalGoals | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalGoals;
  } catch {
    return null;
  }
}

export async function saveLocalGoals(goals: LocalGoals): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(goals));
  } catch {
    // Not saved; the goals still work for this run.
  }
}
