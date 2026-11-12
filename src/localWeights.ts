import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightEntry } from './weight';

// Weight records kept on the phone while signed out. Stored as JSON under one key.
// Needs the AsyncStorage native module, so it only takes effect after a new development build.
const KEY = 'weights.local.v1';

type Stored = { id: string; kg: number; recordedAt: string };

// Any read or write failure is treated as "nothing saved" so the app keeps working.
export async function loadLocalWeights(): Promise<WeightEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as Stored[];
    return items
      .map((s) => ({ id: s.id, kg: s.kg, recordedAt: new Date(s.recordedAt) }))
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  } catch {
    return [];
  }
}

export async function saveLocalWeights(entries: WeightEntry[]): Promise<boolean> {
  try {
    const items: Stored[] = entries.map((e) => ({
      id: e.id,
      kg: e.kg,
      recordedAt: e.recordedAt.toISOString(),
    }));
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
