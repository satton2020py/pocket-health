import AsyncStorage from '@react-native-async-storage/async-storage';
import { readHealthWeights, type HealthWeight } from './healthConnect';

// Health Connect record ids already brought into the app. Kept on the phone, so a weight
// is brought in once, and a record the user deletes in the app does not come back.
const KEY = 'healthWeights.imported.v1';

async function loadImported(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function saveImported(ids: Set<string>): Promise<void> {
  try {
    // Keep the newest 1,000 ids; older records are outside the 30 days read anyway.
    await AsyncStorage.setItem(KEY, JSON.stringify([...ids].slice(-1000)));
  } catch {
    // Not saved; the same weights may be offered again next time, and are skipped as
    // duplicates by time and value.
  }
}

// Weights from Health Connect (for example a scale's app) that are not in the app yet.
// A weight with the same time (to the minute) and value as an existing record is treated
// as the same record and skipped.
export async function newHealthWeights(
  existing: { kg: number; recordedAt: Date }[],
): Promise<{ list: HealthWeight[]; markDone: (ids: string[]) => Promise<void> }> {
  const imported = await loadImported();
  const sameKey = (kg: number, d: Date) => `${Math.floor(d.getTime() / 60000)}:${kg.toFixed(2)}`;
  const have = new Set(existing.map((e) => sameKey(e.kg, e.recordedAt)));
  const list = (await readHealthWeights(30)).filter(
    (w) => !imported.has(w.id) && !have.has(sameKey(w.kg, w.recordedAt)),
  );
  return {
    list,
    markDone: async (ids) => {
      for (const id of ids) imported.add(id);
      await saveImported(imported);
    },
  };
}
