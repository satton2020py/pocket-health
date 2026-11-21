import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  insertRecords,
  getGrantedPermissions,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type SleepResult =
  | { ok: true; night: { start: Date; end: Date; hours: number } | null }
  | { ok: false; reason: 'unsupported' | 'unavailable' | 'denied' | 'error'; detail?: string };

type Session = { start: Date; end: Date; origin: string };

const HOUR = 60 * 60 * 1000;

// The night that belongs to a morning: sessions whose middle falls between 18:00 the day
// before and 12:00 on that morning. A nap after lunch or in the early evening is left out.
function belongsTo(s: Session, morning: Date): boolean {
  const mid = (s.start.getTime() + s.end.getTime()) / 2;
  const from = morning.getTime() - 6 * HOUR;
  const to = morning.getTime() + 12 * HOUR;
  return mid >= from && mid < to;
}

// Total time covered by the sessions, counting overlaps once.
function coveredHours(sessions: Session[]): number {
  const sorted = [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let curStart = 0;
  let curEnd = 0;
  for (const s of sorted) {
    const st = s.start.getTime();
    const en = s.end.getTime();
    if (st > curEnd) {
      total += curEnd - curStart;
      curStart = st;
      curEnd = en;
    } else if (en > curEnd) {
      curEnd = en;
    }
  }
  total += curEnd - curStart;
  return total / HOUR;
}

// Works out one night from all sessions. A night split by waking up once is added together.
// When several apps record the same night, only the app with the most sleep is used, so
// the night is never counted twice.
export function pickNight(
  sessions: Session[],
  morning: Date,
): { start: Date; end: Date; hours: number } | null {
  const mine = sessions.filter((s) => belongsTo(s, morning));
  if (mine.length === 0) return null;
  const byOrigin = new Map<string, Session[]>();
  for (const s of mine) byOrigin.set(s.origin, [...(byOrigin.get(s.origin) ?? []), s]);
  let best: { start: Date; end: Date; hours: number } | null = null;
  for (const group of byOrigin.values()) {
    const hours = Math.round(coveredHours(group) * 10) / 10;
    if (!best || hours > best.hours) {
      best = {
        hours,
        start: new Date(Math.min(...group.map((g) => g.start.getTime()))),
        end: new Date(Math.max(...group.map((g) => g.end.getTime()))),
      };
    }
  }
  return best;
}

async function readSessions(from: Date): Promise<Session[]> {
  const sessions: Session[] = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords('SleepSession', {
      timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: new Date().toISOString() },
      pageToken,
    });
    for (const r of page.records) {
      sessions.push({
        start: new Date(r.startTime),
        end: new Date(r.endTime),
        origin: r.metadata?.dataOrigin ?? 'unknown',
      });
    }
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return sessions;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Reads last night's sleep: this morning's night, or before noon with nothing yet for
// this morning (still up after midnight), the night before.
export async function readLastNightSleep(): Promise<SleepResult> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'unsupported' };

  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { ok: false, reason: 'unavailable', detail: `status=${status}` };
    }
    const initialized = await initialize();
    if (!initialized) return { ok: false, reason: 'unavailable', detail: 'initialize=false' };

    const granted = await getGrantedPermissions();
    const canRead = granted.some(
      (p) => p.accessType === 'read' && p.recordType === 'SleepSession',
    );
    if (!canRead) return { ok: false, reason: 'denied' };

    const now = new Date();
    const today = startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sessions = await readSessions(new Date(yesterday.getTime() - 12 * HOUR));
    let night = pickNight(sessions, today);
    if (!night && now.getHours() < 12) night = pickNight(sessions, yesterday);
    return { ok: true, night };
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

export type SleepNight = { date: Date; hours: number; start: Date | null; end: Date | null };

// Reads sleep for the last `days` mornings. Each night is filed under the morning it ends
// (see pickNight for naps, split nights and several apps).
export async function readSleepHistory(
  days = 7,
): Promise<{ ok: true; nights: SleepNight[] } | { ok: false }> {
  if (Platform.OS !== 'android') return { ok: false };
  try {
    if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) return { ok: false };
    if (!(await initialize())) return { ok: false };
    const granted = await getGrantedPermissions();
    if (!granted.some((p) => p.accessType === 'read' && p.recordType === 'SleepSession')) {
      return { ok: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nights: SleepNight[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      nights.push({ date: d, hours: 0, start: null, end: null });
    }
    // Start the evening before the first morning, so that night is included.
    const sessions = await readSessions(new Date(nights[0].date.getTime() - 12 * HOUR));
    for (const n of nights) {
      const night = pickNight(sessions, n.date);
      if (night) Object.assign(n, night);
    }
    return { ok: true, nights };
  } catch {
    return { ok: false };
  }
}
