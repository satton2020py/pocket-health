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

// A day's medal from how many of the three daily goals were met:
// steps goal, sleep goal, and a weight record. 3 is gold, 2 silver, 1 bronze.
export type Medal = 'gold' | 'silver' | 'bronze' | null;

export type DayGoals = { steps: boolean; sleep: boolean; weight: boolean };

export function medalFor(g: DayGoals): Medal {
  const n = Number(g.steps) + Number(g.sleep) + Number(g.weight);
  return n === 3 ? 'gold' : n === 2 ? 'silver' : n === 1 ? 'bronze' : null;
}

export const MEDAL_LABEL: Record<Exclude<Medal, null>, string> = {
  gold: '金',
  silver: '銀',
  bronze: '銅',
};

export function weighedOn(entries: Dated[], day: Date): boolean {
  const k = dayKey(day);
  return entries.some((e) => dayKey(e.recordedAt) === k);
}

export type DayMedal = { date: Date; goals: DayGoals; medal: Medal };

// One medal per day for the days in `daily` (oldest first). Sleep is filed under the
// morning the night ended, as on the 記録 tab.
export function weekMedals(
  daily: { date: Date; steps: number }[],
  nights: { date: Date; hours: number }[],
  entries: Dated[],
  stepGoal: number,
  sleepGoal: number,
): DayMedal[] {
  const sleepByDay = new Map(nights.map((n) => [dayKey(n.date), n.hours]));
  return daily.map((d) => {
    const goals = {
      steps: d.steps >= stepGoal,
      sleep: (sleepByDay.get(dayKey(d.date)) ?? 0) >= sleepGoal,
      weight: weighedOn(entries, d.date),
    };
    return { date: d.date, goals, medal: medalFor(goals) };
  });
}

// Something to celebrate. Each id is shown once; day ids carry the date.
export type CelebrationEvent = { id: string; title: string; message: string; medal?: Medal };

// Everything worth a celebration right now, most important first.
export function celebrationEvents(input: {
  today: DayGoals;
  stepsKnown: boolean;
  bestStreak: number;
  now?: Date;
}): CelebrationEvent[] {
  const k = dayKey(input.now ?? new Date());
  const list: CelebrationEvent[] = [];
  if (medalFor(input.today) === 'gold') {
    list.push({
      id: `gold:${k}`,
      title: '今日は金メダル！',
      message: '歩数・睡眠・体重の3つをすべて達成しました。',
      medal: 'gold',
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
  if (input.stepsKnown && input.today.steps) {
    list.push({ id: `steps:${k}`, title: '歩数の目標を達成！', message: '今日の歩数が目標に届きました。' });
  }
  if (input.today.sleep) {
    list.push({ id: `sleep:${k}`, title: '睡眠の目標を達成！', message: '昨夜は目標の時間しっかり眠れました。' });
  }
  return list;
}

// Ids for days long past can be dropped from storage; badge ids are kept.
export function pruneSeen(ids: string[], now: Date = new Date()): string[] {
  const limit = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  return ids.filter((id) => {
    const [kind, ...rest] = id.split(':');
    if (kind === 'badge') return true;
    const t = new Date(rest.join(':')).getTime();
    return Number.isFinite(t) && t >= limit;
  });
}
