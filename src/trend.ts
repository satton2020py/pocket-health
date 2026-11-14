export type TrendPoint = { kg: number; recordedAt: Date };

export type Forecast = {
  // Kilograms per week. Negative means losing weight. Null when there is too little data.
  slopePerWeek: number | null;
  // Trend line value at the given time.
  trendNowKg: number | null;
  // Date the trend is expected to reach the goal, or null when it will not.
  reachDate: Date | null;
  // A short Japanese sentence for the screen.
  message: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Keeps only the first record of each day. Weighing again in the evening (after meals)
// would otherwise pull the averages and the forecast up and down within one day.
export function firstOfEachDay<T extends TrendPoint>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const seen = new Set<string>();
  return sorted.filter((p) => {
    const day = p.recordedAt.toDateString();
    if (seen.has(day)) return false;
    seen.add(day);
    return true;
  });
}
const WINDOW_DAYS = 30;
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 7;

// Fits a straight line through the recent weights (least squares) and estimates
// when that line reaches the goal. It uses the trend, not the single latest value,
// so one noisy weigh-in does not move the forecast much.
export function forecastGoal(
  points: TrendPoint[],
  goalKg: number | null,
  now: Date = new Date(),
): Forecast {
  const cutoff = now.getTime() - WINDOW_DAYS * DAY_MS;
  const recent = firstOfEachDay(points)
    .filter((p) => p.recordedAt.getTime() >= cutoff && p.recordedAt.getTime() <= now.getTime())
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const none = (message: string): Forecast => ({
    slopePerWeek: null,
    trendNowKg: null,
    reachDate: null,
    message,
  });

  if (recent.length < MIN_POINTS) {
    return none(`予測には、直近${WINDOW_DAYS}日で3回以上の記録が必要です。`);
  }
  const t0 = recent[0].recordedAt.getTime();
  const spanDays = (recent[recent.length - 1].recordedAt.getTime() - t0) / DAY_MS;
  if (spanDays < MIN_SPAN_DAYS) {
    return none('記録の期間が短いため、予測はまだできません。');
  }

  // x = days since the first record, y = kg.
  const xs = recent.map((p) => (p.recordedAt.getTime() - t0) / DAY_MS);
  const ys = recent.map((p) => p.kg);
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - meanX) ** 2;
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
  }
  const slopePerDay = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slopePerDay * meanX;
  const nowX = (now.getTime() - t0) / DAY_MS;
  const trendNowKg = intercept + slopePerDay * nowX;
  const slopePerWeek = slopePerDay * 7;

  if (goalKg === null) {
    return { slopePerWeek, trendNowKg, reachDate: null, message: '目標体重を設定すると、到達予定日を表示します。' };
  }
  if (trendNowKg <= goalKg) {
    return { slopePerWeek, trendNowKg, reachDate: now, message: '目標体重に到達しています。' };
  }
  if (slopePerDay >= -0.001) {
    return {
      slopePerWeek,
      trendNowKg,
      reachDate: null,
      message: '今の傾向では、目標体重に近づいていません。',
    };
  }

  const daysLeft = (trendNowKg - goalKg) / -slopePerDay;
  // Cap the forecast at two years so a very flat trend does not show a silly date.
  if (daysLeft > 730) {
    return { slopePerWeek, trendNowKg, reachDate: null, message: '到達は2年以上先になる見込みです。' };
  }
  const reachDate = new Date(now.getTime() + daysLeft * DAY_MS);
  return {
    slopePerWeek,
    trendNowKg,
    reachDate,
    message: `このペースなら、約${Math.round(daysLeft)}日後（${reachDate.toLocaleDateString('ja-JP')}頃）に目標に届く見込みです。`,
  };
}

const AVG_DAYS = 7;

// For each record, the average of the records in the 7 days up to and including it.
// Drawn as the smooth line on the weight chart, so a single heavy or light day does not
// change the picture much. Uses all records, so the first days of a period still have
// the days before them.
export function movingAverage<T extends TrendPoint>(points: T[], days = AVG_DAYS): { kg: number; recordedAt: Date }[] {
  const sorted = firstOfEachDay(points);
  return sorted.map((p, i) => {
    const from = p.recordedAt.getTime() - days * DAY_MS;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && sorted[j].recordedAt.getTime() > from; j--) {
      sum += sorted[j].kg;
      n++;
    }
    return { kg: sum / n, recordedAt: p.recordedAt };
  });
}

export type WeightTrend = {
  // Average of the records in the 7 days up to the latest record.
  averageKg: number;
  // Change from the 7 days before that, or null when that week has no records.
  weekChangeKg: number | null;
};

// The weight to show as "now" and to compare with the goal. It is the 7-day average,
// not the single latest weigh-in, so drinking water does not move "目標まであと".
export function weightTrend(all: TrendPoint[]): WeightTrend | null {
  if (all.length === 0) return null;
  const points = firstOfEachDay(all);
  const latest = Math.max(...points.map((p) => p.recordedAt.getTime()));
  const avgBetween = (from: number, to: number) => {
    const inRange = points.filter((p) => p.recordedAt.getTime() > from && p.recordedAt.getTime() <= to);
    return inRange.length > 0 ? inRange.reduce((s, p) => s + p.kg, 0) / inRange.length : null;
  };
  const week = AVG_DAYS * DAY_MS;
  const averageKg = avgBetween(latest - week, latest) as number;
  const before = avgBetween(latest - 2 * week, latest - week);
  return { averageKg, weekChangeKg: before === null ? null : averageKg - before };
}
