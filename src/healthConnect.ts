import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  aggregateGroupByPeriod,
  aggregateRecord,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type DailySteps = { date: Date; steps: number };

export type StepsResult =
  | { ok: true; daily: DailySteps[]; today: { distanceKm: number; kcal: number } }
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
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
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

    // Aggregate per day instead of summing raw records. Health Connect merges overlapping
    // records from several sources (phone and watch), so summing records double-counts.
    const groups = await aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: first.toISOString(),
        endTime: new Date().toISOString(),
      },
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    });

    const buckets: DailySteps[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      buckets.push({ date: d, steps: 0 });
    }
    for (const g of groups) {
      const started = new Date(g.startTime);
      const index = buckets.findIndex(
        (b) =>
          b.date.getFullYear() === started.getFullYear() &&
          b.date.getMonth() === started.getMonth() &&
          b.date.getDate() === started.getDate(),
      );
      if (index >= 0) buckets[index].steps = g.result.COUNT_TOTAL ?? 0;
    }
    // Distance and calories are optional: if they cannot be read, show 0 instead of failing the steps.
    const todayFilter = {
      operator: 'between' as const,
      startTime: today.toISOString(),
      endTime: new Date().toISOString(),
    };
    let distanceKm = 0;
    let kcal = 0;
    try {
      const dist = await aggregateRecord({ recordType: 'Distance', timeRangeFilter: todayFilter });
      distanceKm = dist.DISTANCE?.inKilometers ?? 0;
    } catch {
      distanceKm = 0;
    }
    try {
      const cal = await aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: todayFilter,
      });
      kcal = cal.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
    } catch {
      kcal = 0;
    }

    return { ok: true, daily: buckets, today: { distanceKm, kcal } };
  } catch (e) {
    return { ok: false, reason: 'error', detail: String((e as Error)?.message ?? e) };
  }
}
