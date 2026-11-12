import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
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
