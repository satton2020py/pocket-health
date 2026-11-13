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

// Asks for the notification permission. Returns false when it is refused.
export async function ensureNotificationPermission(): Promise<boolean> {
  const perm = await Notifications.requestPermissionsAsync();
  return perm.granted;
}

// Saves the reminder setting on the phone.
export async function storeReminder(r: Reminder): Promise<void> {
  await saveReminder(r);
}

const ID_PREFIX = 'daily-reminder-';
// How many days ahead are booked. Opening the app books them again from that day.
const DAYS_AHEAD = 30;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

let queue: Promise<void> = Promise.resolve();

// Books one reminder per day for the next 30 days, skipping today when a weight is
// already recorded today. Each day is booked on its own (not as a repeating alarm), so a
// day can be skipped. Only this app's reminders are replaced; a test notification stays.
// Calls run one after another, so two quick changes never leave double reminders.
export function scheduleReminders(r: Reminder, lastRecordedAt: Date | null): Promise<void> {
  queue = queue.then(async () => {
    const booked = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of booked) {
      // A repeating daily alarm is from an older version of the app; it is replaced too.
      const oldDaily = (n.trigger as { type?: string } | null)?.type === 'daily';
      if (n.identifier.startsWith(ID_PREFIX) || oldDaily) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    if (!r.enabled) return;
    // Do not ask here: this runs on start and after each record. Asking is done when the
    // user turns the reminder on.
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;

    const now = new Date();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const at = new Date(now);
      at.setDate(now.getDate() + i);
      at.setHours(r.hour, r.minute, 0, 0);
      if (at <= now) continue;
      if (lastRecordedAt && sameDay(lastRecordedAt, at)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${at.toDateString()}`,
        content: {
          title: 'ポケットヘルス',
          body: '今日の体重がまだ記録されていません。',
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  }).catch(() => {
    // A failed booking is tried again the next time the app opens or a weight is recorded.
  });
  return queue;
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
