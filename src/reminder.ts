import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

// A daily reminder to record weight and check steps. Stored on the phone.
export type Reminder = { enabled: boolean; hour: number; minute: number };

const KEY = 'reminder.v1';
export const DEFAULT_REMINDER: Reminder = { enabled: false, hour: 21, minute: 0 };

export async function loadReminder(): Promise<Reminder> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_REMINDER;
    return { ...DEFAULT_REMINDER, ...(JSON.parse(raw) as Partial<Reminder>) };
  } catch {
    return DEFAULT_REMINDER;
  }
}

async function saveReminder(r: Reminder): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Not saved; the reminder still works for this run.
  }
}

// Turns the daily reminder on or off and sets its time. Returns false when the
// notification permission is refused.
export async function applyReminder(r: Reminder): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!r.enabled) {
    await saveReminder(r);
    return true;
  }
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ポケットヘルス',
      body: '体重と睡眠を記録しましょう。',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour: r.hour,
      minute: r.minute,
    },
  });
  await saveReminder(r);
  return true;
}

// Sends one test notification about a minute from now, so the setting can be checked.
export async function scheduleTestReminder(): Promise<boolean> {
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ポケットヘルス',
      body: 'テスト通知です。',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
    },
  });
  return true;
}
