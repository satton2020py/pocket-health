// Small summaries shown on the Today, Records and Goal screens. No screen code here.

type Dated = { recordedAt: Date };

const dayKey = (d: Date) => d.toDateString();

// Days in a row with a weight record, ending today, or yesterday when today has none yet
// (so the count does not drop to 0 in the morning before weighing).
export function recordStreak(entries: Dated[], now: Date = new Date()): number {
  const days = new Set(entries.map((e) => dayKey(e.recordedAt)));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export type Milestone = { kg: number; reached: boolean };

// Steps of 1 kg from the first record down to the goal, each marked reached when the
// 7-day average is at or below it. The goal itself is the last step.
export function milestones(startKg: number, goalKg: number, currentKg: number): Milestone[] {
  if (goalKg >= startKg) return [];
  const list: Milestone[] = [];
  for (let kg = Math.floor(startKg) - (Number.isInteger(startKg) ? 1 : 0); kg > goalKg; kg--) {
    list.push({ kg, reached: currentKg <= kg });
  }
  list.push({ kg: goalKg, reached: currentKg <= goalKg });
  return list;
}

// Minutes after 18:00, so bedtimes around midnight (23:30, 0:30) are close together.
const minutesFromEvening = (d: Date) => {
  const m = d.getHours() * 60 + d.getMinutes() - 18 * 60;
  return m < 0 ? m + 24 * 60 : m;
};

export const clockFromEvening = (m: number) => {
  const total = (Math.round(m) + 18 * 60) % (24 * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// Average bedtime and how much it moves from night to night (standard deviation in minutes).
// Null with fewer than 3 nights.
export function bedtimeSpread(
  nights: { start: Date | null }[],
): { averageMin: number; spreadMin: number; count: number } | null {
  const mins = nights.filter((n) => n.start).map((n) => minutesFromEvening(n.start as Date));
  if (mins.length < 3) return null;
  const avg = mins.reduce((s, m) => s + m, 0) / mins.length;
  const sd = Math.sqrt(mins.reduce((s, m) => s + (m - avg) ** 2, 0) / mins.length);
  return { averageMin: avg, spreadMin: Math.round(sd), count: mins.length };
}

// Body mass index from kg and cm, rounded to 1 decimal place.
export function bmi(kg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

// The Japanese Society for the Study of Obesity bands.
export function bmiLabel(value: number): string {
  if (value < 18.5) return '低体重';
  if (value < 25) return '普通体重';
  return '肥満';
}

// Monday of the week a date falls in, as a key for "this week's review was closed".
export function weekKey(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toDateString();
}
