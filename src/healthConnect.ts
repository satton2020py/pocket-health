import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type DailySteps = { date: Date; steps: number };

export type StepsResult =
  | { ok: true; daily: DailySteps[] }
  | { ok: false; reason: 'unsupported' | 'unavailable' | 'denied' | 'error'; detail?: string };

// Reads steps for the last `days` days (oldest first, today last) from Health Connect.
// Each day is counted from local midnight to midnight. Any failure returns a reason.
export async function readRecentSteps(days = 7): Promise<StepsResult> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'unsupported' };

  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { ok: false, reason: 'unavailable', detail: `status=${status}` };
    }
    const initialized = await initialize();
    if (!initialized) return { ok: false, reason: 'unavailable', detail: 'initialize=false' };

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    const canReadSteps = granted.some(
      (p) => p.accessType === 'read' && p.recordType === 'Steps',
    );
    if (!canReadSteps)
      return {
        ok: false,
        reason: 'denied',
        detail: `status=${status} granted=${JSON.stringify(granted)}`,
      };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const first = new Date(today);
    first.setDate(today.getDate() - (days - 1));

    const { records } = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: first.toISOString(),
        endTime: new Date().toISOString(),
      },
    });

    // Build one bucket per local day, then add each record to the day it started on.
    const buckets: DailySteps[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      buckets.push({ date: d, steps: 0 });
    }
    for (const r of records) {
      const started = new Date(r.startTime);
      const index = buckets.findIndex(
        (b) =>
          b.date.getFullYear() === started.getFullYear() &&
          b.date.getMonth() === started.getMonth() &&
          b.date.getDate() === started.getDate(),
      );
      if (index >= 0) buckets[index].steps += r.count;
    }
    return { ok: true, daily: buckets };
  } catch (e) {
    return { ok: false, reason: 'error', detail: String((e as Error)?.message ?? e) };
  }
}
