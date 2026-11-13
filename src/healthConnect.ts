import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  aggregateRecord,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type DailySteps = { date: Date; steps: number };

// One app that writes steps to Health Connect, with its total over the period.
export type StepSource = { origin: string; total: number };

export type StepsResult =
  | {
      ok: true;
      daily: DailySteps[];
      sources: StepSource[];
      chosen: string | null;
      today: { distanceKm: number; kcal: number };
      // Why distance or calories show 0, or null when both were read.
      activityDetail: string | null;
    }
  | { ok: false; reason: 'unsupported' | 'unavailable' | 'denied' | 'error'; detail?: string };

function makeBuckets(first: Date, days: number): DailySteps[] {
  const buckets: DailySteps[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    buckets.push({ date: d, steps: 0 });
  }
  return buckets;
}

// Finds the local-day bucket that a timestamp falls on, or -1 when it is outside the period.
function bucketIndex(buckets: DailySteps[], t: Date): number {
  return buckets.findIndex(
    (b) =>
      b.date.getFullYear() === t.getFullYear() &&
      b.date.getMonth() === t.getMonth() &&
      b.date.getDate() === t.getDate(),
  );
}

// Reads steps for the last `days` days from Health Connect.
//
// Duplicate counting: several apps (Samsung Health, Google Fit, the phone's own pedometer)
// can each store the same steps. Adding them together double-counts. So this sums per app
// (dataOrigin) and uses ONE app's numbers, not a total over all apps. The app to use is
// `preferredOrigin` when it has data; otherwise the app with the most steps in the period.
export async function readRecentSteps(
  days = 7,
  preferredOrigin: string | null = null,
): Promise<StepsResult> {
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
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: first.toISOString(),
      endTime: new Date().toISOString(),
    };

    // Read every step record in the period, following pages.
    const records: { startTime: string; count: number; origin: string }[] = [];
    let pageToken: string | undefined;
    do {
      const page = await readRecords('Steps', { timeRangeFilter, pageToken });
      for (const r of page.records) {
        records.push({
          startTime: r.startTime,
          count: r.count,
          origin: r.metadata?.dataOrigin ?? 'unknown',
        });
      }
      pageToken = page.pageToken;
    } while (pageToken);

    // Daily totals for each app separately.
    const byOrigin = new Map<string, DailySteps[]>();
    for (const rec of records) {
      let buckets = byOrigin.get(rec.origin);
      if (!buckets) {
        buckets = makeBuckets(first, days);
        byOrigin.set(rec.origin, buckets);
      }
      const index = bucketIndex(buckets, new Date(rec.startTime));
      if (index >= 0) buckets[index].steps += rec.count;
    }

    const sources: StepSource[] = [...byOrigin.entries()]
      .map(([origin, buckets]) => ({
        origin,
        total: buckets.reduce((sum, d) => sum + d.steps, 0),
      }))
      .sort((a, b) => b.total - a.total);

    // Use one app only: the preferred one if it has data, otherwise the biggest.
    const chosen =
      preferredOrigin && sources.some((s) => s.origin === preferredOrigin)
        ? preferredOrigin
        : (sources[0]?.origin ?? null);
    const daily = chosen ? byOrigin.get(chosen)! : makeBuckets(first, days);

    // Distance and calories use the same app, so they match the steps.
    // If they cannot be read, show 0 instead of failing the steps.
    const todayFilter = {
      operator: 'between' as const,
      startTime: today.toISOString(),
      endTime: new Date().toISOString(),
    };
    const originFilter = chosen ? { dataOriginFilter: [chosen] } : {};
    let distanceKm = 0;
    let kcal = 0;
    // Collects why distance or calories could not be shown, so the screen can say so.
    const problems: string[] = [];
    // If the step app has no distance or calories today, use what other apps have.
    // This is not added to the steps, so it does not double count steps.
    try {
      const dist = await aggregateRecord({
        recordType: 'Distance',
        timeRangeFilter: todayFilter,
        ...originFilter,
      });
      distanceKm = dist.DISTANCE?.inKilometers ?? 0;
      if (distanceKm === 0 && chosen) {
        const any = await aggregateRecord({
          recordType: 'Distance',
          timeRangeFilter: todayFilter,
        });
        distanceKm = any.DISTANCE?.inKilometers ?? 0;
      }
      if (distanceKm === 0) problems.push('距離: 今日の記録がありません');
    } catch (e) {
      problems.push(`距離: ${String((e as Error)?.message ?? e)}`);
    }
    try {
      const cal = await aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: todayFilter,
        ...originFilter,
      });
      kcal = cal.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
      if (kcal === 0 && chosen) {
        const any = await aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter: todayFilter,
        });
        kcal = any.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
      }
      if (kcal === 0) problems.push('カロリー: 今日の記録がありません');
    } catch (e) {
      problems.push(`カロリー: ${String((e as Error)?.message ?? e)}`);
    }

    return {
      ok: true,
      daily,
      sources,
      chosen,
      today: { distanceKm, kcal },
      activityDetail: problems.length > 0 ? problems.join(' / ') : null,
    };
  } catch (e) {
    return { ok: false, reason: 'error', detail: String((e as Error)?.message ?? e) };
  }
}
