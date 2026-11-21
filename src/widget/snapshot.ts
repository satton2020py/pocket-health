import AsyncStorage from '@react-native-async-storage/async-storage';

// What the home-screen widget shows. The app saves it each time its numbers change; the
// widget only reads it, because the widget runs without the app open.
export type WidgetSnapshot = {
  steps: number | null;
  stepGoal: number;
  averageKg: number | null;
  remainingKg: number | null;
  updatedAt: number;
};

const KEY = 'widget.snapshot.v1';

export async function saveSnapshot(s: WidgetSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // The widget keeps the last saved numbers.
  }
}

export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}
