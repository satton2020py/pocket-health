// Badges, daily medals and the moments worth a celebration. No screen code here.

import { recordStreak } from './insights';

type Dated = { recordedAt: Date };

const dayKey = (d: Date) => d.toDateString();

// Badge levels for days in a row with a weight record.
export const STREAK_BADGES = [3, 7, 14, 30, 60, 100] as const;

// The longest run of days in a row with a weight record, in the whole history.
export function longestStreak(entries: Dated[]): number {
  const days = [...new Set(entries.map((e) => dayKey(e.recordedAt)))]
    .map((k) => new Date(k).getTime())
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const t of days) {
    const d = new Date(t);
    if (prev) {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 1);
      run = dayKey(next) === dayKey(d) ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export type StreakSummary = {
  current: number;
  best: number;
  // Badge levels reached at least once, from the best run.
  earned: number[];
  // The next level above the current run, and how many days are left to it.
  next: { days: number; left: number } | null;
};

export function streakSummary(entries: Dated[], now: Date = new Date()): StreakSummary {
  const current = recordStreak(entries, now);
  const best = Math.max(longestStreak(entries), current);
  const earned = STREAK_BADGES.filter((n) => best >= n);
  const nextDays = STREAK_BADGES.find((n) => n > current) ?? null;
  return {
    current,
    best,
    earned: [...earned],
    next: nextDays !== null ? { days: nextDays, left: nextDays - current } : null,
  };
}

// Steps and sleep are judged day by day, each on its own. Weight is judged by the week,
// since a weigh-in cannot beat the goal every day.
export type Medal = 'gold' | 'silver' | 'bronze' | null;

export const MEDAL_LABEL: Record<Exclude<Medal, null>, string> = {
  gold: '金',
  silver: '銀',
  bronze: '銅',
};

// Steps: reaching the goal is bronze, 125% silver, 150% gold.
export function stepMedal(steps: number, goal: number): Medal {
  if (goal <= 0 || steps < goal) return null;
  const r = steps / goal;
  return r >= 1.5 ? 'gold' : r >= 1.25 ? 'silver' : 'bronze';
}

export const sleepReached = (hours: number | null | undefined, goal: number) =>
  hours !== null && hours !== undefined && hours > 0 && hours >= goal;

export const WEIGHT_STEP_KG = 0.5;

// How many 500 g steps the 7-day average is below the week before. 0 when it did not go down.
export function weightUnits(weekChangeKg: number | null): number {
  if (weekChangeKg === null || weekChangeKg >= 0) return 0;
  // A little slack so 0.4999 from rounding still counts as 500 g.
  return Math.floor((-weekChangeKg + 1e-6) / WEIGHT_STEP_KG);
}

export function weighedOn(entries: Dated[], day: Date): boolean {
  const k = dayKey(day);
  return entries.some((e) => dayKey(e.recordedAt) === k);
}

export type DayResult = { date: Date; steps: Medal; sleep: boolean };

// Steps medal and sleep result for each day in `daily` (oldest first). Sleep is filed
// under the morning the night ended, as on the 記録 tab.
export function weekResults(
  daily: { date: Date; steps: number }[],
  nights: { date: Date; hours: number }[],
  stepGoal: number,
  sleepGoal: number,
): DayResult[] {
  const sleepByDay = new Map(nights.map((n) => [dayKey(n.date), n.hours]));
  return daily.map((d) => ({
    date: d.date,
    steps: stepMedal(d.steps, stepGoal),
    sleep: sleepReached(sleepByDay.get(dayKey(d.date)), sleepGoal),
  }));
}

// Something to celebrate. Each id is shown once; day ids end with the date.
export type CelebrationEvent = { id: string; title: string; message: string; medal?: Medal };

// Everything worth a celebration right now, most important first.
export function celebrationEvents(input: {
  stepMedal: Medal;
  sleepReached: boolean;
  weightUnits: number;
  bestStreak: number;
  weekId: string;
  now?: Date;
}): CelebrationEvent[] {
  const k = dayKey(input.now ?? new Date());
  const list: CelebrationEvent[] = [];
  if (input.weightUnits > 0) {
    const kg = input.weightUnits * WEIGHT_STEP_KG;
    list.push({
      id: `weight${input.weightUnits}:${input.weekId}`,
      title: `1週間で ${kg.toFixed(1)} kg 減！`,
      message: '7日間の平均が、前の週より減りました。',
    });
  }
  const badge = [...STREAK_BADGES].reverse().find((n) => input.bestStreak >= n);
  if (badge !== undefined) {
    list.push({
      id: `badge:${badge}`,
      title: `${badge}日連続バッジ`,
      message: `${badge}日続けて体重を記録しました。この調子です。`,
    });
  }
  if (input.stepMedal) {
    const m = input.stepMedal;
    list.push({
      id: `steps-${m}:${k}`,
      title: m === 'bronze' ? '歩数の目標を達成！' : `歩数で${MEDAL_LABEL[m]}メダル！`,
      message:
        m === 'bronze'
          ? '今日の歩数が目標に届きました。'
          : `今日は目標の${m === 'gold' ? '1.5' : '1.25'}倍歩きました。`,
      medal: m,
    });
  }
  if (input.sleepReached) {
    list.push({ id: `sleep:${k}`, title: '睡眠の目標を達成！', message: '昨夜は目標の時間しっかり眠れました。' });
  }
  return list;
}

// Ids for days long past can be dropped from storage; badge ids are kept.
export function pruneSeen(ids: string[], now: Date = new Date()): string[] {
  const limit = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  return ids.filter((id) => {
    const [kind, date] = id.split(':');
    if (kind === 'badge') return true;
    const t = new Date(date).getTime();
    return Number.isFinite(t) && t >= limit;
  });
}
