import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type StepsResult =
  | { ok: true; steps: number }
  | { ok: false; reason: 'unsupported' | 'unavailable' | 'denied' | 'error' };

// Reads today's steps (local midnight to now) from Health Connect.
// Any failure returns a reason so the screen can fall back to manual entry.
export async function readTodaySteps(): Promise<StepsResult> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'unsupported' };

  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { ok: false, reason: 'unavailable' };
    }
    const initialized = await initialize();
    if (!initialized) return { ok: false, reason: 'unavailable' };

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    const canReadSteps = granted.some(
      (p) => p.accessType === 'read' && p.recordType === 'Steps',
    );
    if (!canReadSteps) return { ok: false, reason: 'denied' };

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { records } = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    });
    const steps = records.reduce((sum, r) => sum + r.count, 0);
    return { ok: true, steps };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
