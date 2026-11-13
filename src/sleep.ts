import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type SleepResult =
  | { ok: true; night: { start: Date; end: Date; hours: number } | null }
  | { ok: false; reason: 'unsupported' | 'unavailable' | 'denied' | 'error'; detail?: string };

// Reads the most recent sleep session that ended in the last 36 hours (last night).
// Health Connect stores sleep as sessions with a start and an end time.
export async function readLastNightSleep(): Promise<SleepResult> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'unsupported' };

  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { ok: false, reason: 'unavailable', detail: `status=${status}` };
    }
    const initialized = await initialize();
    if (!initialized) return { ok: false, reason: 'unavailable', detail: 'initialize=false' };

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'SleepSession' },
    ]);
    const canRead = granted.some(
      (p) => p.accessType === 'read' && p.recordType === 'SleepSession',
    );
    if (!canRead) return { ok: false, reason: 'denied' };

    const now = new Date();
    const from = new Date(now.getTime() - 36 * 60 * 60 * 1000);
    const { records } = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: from.toISOString(),
        endTime: now.toISOString(),
      },
    });

    // Use the session that ended most recently. Sessions from several apps can overlap,
    // so only the latest one is shown rather than adding them up.
    let latest: { start: Date; end: Date } | null = null;
    for (const r of records) {
      const end = new Date(r.endTime);
      if (!latest || end > latest.end) {
        latest = { start: new Date(r.startTime), end };
      }
    }
    if (!latest) return { ok: true, night: null };

    const hours = (latest.end.getTime() - latest.start.getTime()) / (60 * 60 * 1000);
    return { ok: true, night: { ...latest, hours: Math.round(hours * 10) / 10 } };
  } catch (e) {
    return { ok: false, reason: 'error', detail: String((e as Error)?.message ?? e) };
  }
}

// Reads "23:30" or "7:05" into hour and minute. Returns null for anything else.
export function parseClock(raw: string): { h: number; m: number } | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

// Works out the start and end of last night from the bedtime and wake-up time typed by the user.
// The wake-up time is on the most recent day that is not in the future; bedtime is the
// evening before it when it is later in the day than the wake-up time.
export function nightFrom(
  bed: { h: number; m: number },
  wake: { h: number; m: number },
  now: Date = new Date(),
): { start: Date; end: Date } {
  const end = new Date(now);
  end.setHours(wake.h, wake.m, 0, 0);
  if (end > now) end.setDate(end.getDate() - 1);

  const start = new Date(end);
  start.setHours(bed.h, bed.m, 0, 0);
  if (start >= end) start.setDate(start.getDate() - 1);
  return { start, end };
}

// Writes one sleep session to Health Connect. Returns an error message, or null when saved.
export async function writeSleep(start: Date, end: Date): Promise<string | null> {
  if (Platform.OS !== 'android') return 'このデバイスでは使えません。';
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return 'Health Connectが使えません。';
    }
    await initialize();
    const granted = await requestPermission([
      { accessType: 'write', recordType: 'SleepSession' },
    ]);
    const canWrite = granted.some(
      (p) => p.accessType === 'write' && p.recordType === 'SleepSession',
    );
    if (!canWrite) return '睡眠の書き込みが許可されていません。';

    await insertRecords([
      {
        recordType: 'SleepSession',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        title: '手動入力',
      },
    ]);
    return null;
  } catch (e) {
    return `保存できませんでした。（${String((e as Error)?.message ?? e)}）`;
  }
}
