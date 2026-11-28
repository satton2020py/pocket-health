import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers that the first-run explanation was shown, so it appears only once.
const KEY = 'onboarded.v1';

export async function loadOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // If storage cannot be read, do not block the app behind the first-run screen.
    return true;
  }
}

export async function saveOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Not saved; the screen may show again next time.
  }
}
