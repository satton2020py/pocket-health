import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { type Palette, usePalette, useStyles } from './theme';
import { type Clock, clockText, DateTimePicker, dayLabel, TimePicker } from './pickers';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';
import { useWeightText, WeightInput } from './WeightInput';
import { weightTrend } from './trend';
import { bmi, bmiLabel, milestones, recordStreak, weekKey } from './insights';
import type { DailySteps } from './healthConnect';
import type { SleepNight } from './sleep';

export const DEFAULT_STEP_GOAL = 8000;

// Where the step numbers stand: read, still loading, not allowed, or not available on this phone.
export type StepsStatus = 'loading' | 'ok' | 'denied' | 'unsupported' | 'error';

type Props = {
  entries: WeightEntry[];
  latest: WeightEntry | null;
  goalKg: number | null;
  onAddWeight: (kg: number, at: Date) => Promise<boolean>;
  weightError: string | null;
  steps: number;
  stepGoal: number;
  stepsStatus: StepsStatus;
  heightCm: number | null;
  nights: SleepNight[];
  daily: DailySteps[];
  sleepGoal: number;
  onAllowHealth: () => void;
  activity: { distanceKm: number; kcal: number };
  sleep: { hours: number; start: Date; end: Date } | null;
  sleepMessage: string | null;
  onSaveSleep: (bed: Clock, wake: Clock) => Promise<string | null>;
};

const timeOf = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

// Friendly name for an app's package name. Unknown apps show their last package part.
export function sourceLabel(origin: string): string {
  if (origin.includes('shealth')) return 'Samsung Health';
  if (origin.includes('fitness')) return 'Google Fit';
  if (origin === 'unknown') return '不明';
  // Package names contain dots. An id without dots is not a package name, so show it as unknown.
  if (!origin.includes('.')) return '不明なアプリ';
  const last = origin.split('.').pop() ?? origin;
  // A long id made of letters and digits (no words) is not a readable app name either.
  if (/^[a-z0-9]{20,}$/i.test(last) && /\d/.test(last)) return '不明なアプリ';
  return last;
}

// Records a weight from the Today screen. Starts from the last value, so most days only
// need a tap or two on ±0.1 and then "記録する".
function WeightCard({
  entries,
  latest,
  goalKg,
  heightCm,
  onAdd,
  error,
}: {
  entries: WeightEntry[];
  heightCm: number | null;
  latest: WeightEntry | null;
  goalKg: number | null;
  onAdd: Props['onAddWeight'];
  error: string | null;
}) {
  const styles = useStyles(makeStyles);
  const [text, setText, resetText] = useWeightText(latest?.kg ?? null);
  const [at, setAt] = useState<Date | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function record() {
    const kg = parseWeightInput(text);
    if (kg === null) {
      setInputError('20〜300kgの数字を入力してください（小数点2位まで）。');
      return;
    }
    setInputError(null);
    setBusy(true);
    const ok = await onAdd(kg, at ?? new Date());
    setBusy(false);
    if (ok) {
      setAt(null);
      resetText();
    }
  }

  // Compare the 7-day average with the goal, so one heavy morning does not move it.
  const trend = weightTrend(entries);
  const remaining = goalKg !== null && trend !== null ? trend.averageKg - goalKg : null;
  const change = trend?.weekChangeKg ?? null;
  const streak = recordStreak(entries);
  // The next 1 kg step on the way to the goal, from the Goal tab's list.
  const first = entries.length > 0 ? entries.reduce((a, b) => (a.recordedAt < b.recordedAt ? a : b)) : null;
  const nextStep =
    goalKg !== null && first !== null && trend !== null
      ? milestones(first.kg, goalKg, trend.averageKg).find((m) => !m.reached) ?? null
      : null;
  const bmiValue = heightCm !== null && trend !== null ? bmi(trend.averageKg, heightCm) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>体重</Text>
      {trend ? (
        <>
          <View style={styles.trendRow}>
            <Text style={styles.big}>{formatWeight(trend.averageKg)} kg</Text>
            {change !== null ? (
              <Text style={[styles.change, change < 0 && styles.changeDown]}>
                先週より {change > 0 ? '+' : ''}
                {formatWeight(change)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.sub}>
            7日間の平均
            {remaining !== null
              ? remaining > 0
                ? ` ／ 目標まであと ${formatWeight(remaining)} kg`
                : ' ／ 目標に到達しています'
              : ''}
          </Text>
          {nextStep && nextStep.kg !== goalKg ? (
            <Text style={styles.sub}>
              次の小さな目標 {formatWeight(nextStep.kg)} kg（あと {formatWeight(trend.averageKg - nextStep.kg)} kg）
            </Text>
          ) : null}
          {bmiValue !== null ? (
            <Text style={styles.sub}>
              BMI {bmiValue.toFixed(1)}（{bmiLabel(bmiValue)}）
            </Text>
          ) : null}
          {latest ? (
            <Text style={styles.sub}>
              前回 {formatWeight(latest.kg)} kg（{dayLabel(latest.recordedAt)} {timeOf(latest.recordedAt)}）
              {streak >= 2 ? ` ／ ${streak}日連続で記録中` : ''}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.sub}>最初の体重を入力してください。</Text>
      )}

      <WeightInput
        text={text}
        onChange={(t) => {
          setText(t);
          setInputError(null);
        }}
        fallbackKg={latest?.kg ?? 60}
      />

      <Pressable
        onPress={() => setAt(at ? null : new Date())}
        accessibilityRole="button"
        hitSlop={6}
      >
        <Text style={styles.link}>
          日時：{at ? `${dayLabel(at)} ${timeOf(at)}` : '今'}　{at ? '今に戻す' : '変える'}
        </Text>
      </Pressable>
      {at ? <DateTimePicker value={at} onChange={setAt} /> : null}

      {inputError || error ? <Text style={styles.error}>{inputError ?? error}</Text> : null}
      <Pressable
        style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
        onPress={record}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>{busy ? '保存中…' : '記録する'}</Text>
      </Pressable>
    </View>
  );
}

// Last night's sleep, with a folded form to enter it by hand.
function SleepCard({
  sleep,
  sleepMessage,
  onSave,
}: {
  sleep: Props['sleep'];
  sleepMessage: string | null;
  onSave: Props['onSaveSleep'];
}) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [bed, setBed] = useState<Clock>({ h: 23, m: 0 });
  const [wake, setWake] = useState<Clock>({ h: 7, m: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await onSave(bed, wake);
    setBusy(false);
    setError(result);
    if (!result) setOpen(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>昨夜の睡眠</Text>
      {sleep ? (
        <>
          <Text style={styles.big}>{sleep.hours.toFixed(1)} 時間</Text>
          <Text style={styles.sub}>
            {timeOf(sleep.start)} 〜 {timeOf(sleep.end)}
          </Text>
        </>
      ) : (
        <Text style={styles.sub}>{sleepMessage ?? '読み込み中…'}</Text>
      )}

      {open ? (
        <View style={styles.form}>
          <Text style={styles.sub}>就寝 {clockText(bed)}</Text>
          <TimePicker value={bed} onChange={setBed} />
          <Text style={styles.sub}>起床 {clockText(wake)}</Text>
          <TimePicker value={wake} onChange={setWake} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.formRow}>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.ghostBtn}>
              <Text style={styles.ghostText}>やめる</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={styles.smallCta}>
              <Text style={styles.ctaText}>{busy ? '保存中…' : '保存する'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.link}>手で入力</Text>
        </Pressable>
      )}
    </View>
  );
}

const REVIEW_KEY = 'weekReview.closed.v1';

// A look back at the last 7 days, shown on Sunday and Monday until closed.
function WeekReview({
  entries,
  daily,
  nights,
  stepGoal,
  sleepGoal,
}: {
  entries: WeightEntry[];
  daily: DailySteps[];
  nights: SleepNight[];
  stepGoal: number;
  sleepGoal: number;
}) {
  const styles = useStyles(makeStyles);
  const now = new Date();
  const showToday = now.getDay() === 0 || now.getDay() === 1;
  // The same id on Sunday and the Monday after, so closing it once hides it for both days.
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const id = weekKey(yesterday);
  const [closed, setClosed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(REVIEW_KEY)
      .then((v) => setClosed(v === id))
      .catch(() => setClosed(false));
  }, [id]);

  if (!showToday || closed !== false) return null;

  const trend = weightTrend(entries);
  const stepDays = daily.filter((d) => d.steps > 0);
  const stepAvg =
    stepDays.length > 0 ? Math.round(stepDays.reduce((s, d) => s + d.steps, 0) / stepDays.length) : null;
  const stepReached = daily.filter((d) => d.steps >= stepGoal).length;
  const sleepDays = nights.filter((n) => n.hours > 0);
  const sleepAvg =
    sleepDays.length > 0 ? sleepDays.reduce((s, n) => s + n.hours, 0) / sleepDays.length : null;
  const sleepReached = nights.filter((n) => n.hours >= sleepGoal).length;

  function close() {
    setClosed(true);
    AsyncStorage.setItem(REVIEW_KEY, id).catch(() => {});
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>この1週間のふりかえり</Text>
      <Text style={styles.sub}>
        体重：
        {trend
          ? `平均 ${formatWeight(trend.averageKg)} kg${
              trend.weekChangeKg !== null
                ? `（前の週より ${trend.weekChangeKg > 0 ? '+' : ''}${formatWeight(trend.weekChangeKg)} kg）`
                : ''
            }`
          : '記録なし'}
      </Text>
      <Text style={styles.sub}>
        歩数：
        {stepAvg !== null
          ? `平均 ${stepAvg.toLocaleString('ja-JP')}歩、目標達成 ${stepReached}/${daily.length}日`
          : '記録なし'}
      </Text>
      <Text style={styles.sub}>
        睡眠：
        {sleepAvg !== null
          ? `平均 ${sleepAvg.toFixed(1)}時間、${sleepGoal}時間以上 ${sleepReached}/${nights.length}日`
          : '記録なし'}
      </Text>
      <Pressable onPress={close} accessibilityRole="button" hitSlop={6}>
        <Text style={styles.link}>閉じる</Text>
      </Pressable>
    </View>
  );
}

// Steps for today. When Health Connect is not allowed, it says so and offers the
// permission screen, instead of showing 0 steps as if the user had not walked.
function StepsCard({
  steps,
  stepGoal,
  status,
  activity,
  onAllow,
}: {
  steps: number;
  stepGoal: number;
  status: StepsStatus;
  activity: Props['activity'];
  onAllow: () => void;
}) {
  const styles = useStyles(makeStyles);
  const p = usePalette();

  if (status !== 'ok') {
    const text =
      status === 'loading'
        ? '歩数を読み込んでいます…'
        : status === 'denied'
          ? 'Health Connectを許可すると、今日の歩数がここに出ます。'
          : status === 'unsupported'
            ? 'このスマホではHealth Connectが使えないため、歩数は表示されません。体重と睡眠は記録できます。'
            : '歩数を読み込めませんでした。下に引っ張ると読み直します。';
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>歩数</Text>
        <Text style={styles.sub}>{text}</Text>
        {status === 'denied' ? (
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={onAllow}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Health Connectを許可する</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // The ring stops at a full circle, but the percentage keeps counting past 100%.
  const ratio = Math.min(steps / stepGoal, 1);
  const percent = Math.round((steps / stepGoal) * 100);
  const size = RING;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Distance and calories are hidden while Health Connect gives 0 for both, so they do
  // not look like a measurement.
  const showActivity = activity.distanceKm > 0 || activity.kcal > 0;

  return (
    <View style={[styles.card, styles.center]}>
      <Text style={[styles.cardTitle, styles.stretch]}>歩数</Text>
      <View style={styles.ringBox}>
        <Svg width={size} height={size} style={styles.svg}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={p.line} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={p.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
          />
        </Svg>
        <Text style={styles.steps}>{steps.toLocaleString('ja-JP')}</Text>
        <Text style={styles.sub}>目標の {percent}%</Text>
      </View>
      <Text style={styles.sub}>
        目標 {stepGoal.toLocaleString('ja-JP')}歩
        {showActivity
          ? ` ｜ ${activity.distanceKm.toFixed(2)} km ｜ ${Math.round(activity.kcal).toLocaleString('ja-JP')} kcal`
          : ''}
      </Text>
    </View>
  );
}

const RING = 128;

// Three cards: steps, then the weight entry, then last night's sleep.
// The 7-day charts are on the 記録 tab.
export function TodayScreen(props: Props) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>今日 {dayLabel(new Date())}</Text>

      <StepsCard
        steps={props.steps}
        stepGoal={props.stepGoal}
        status={props.stepsStatus}
        activity={props.activity}
        onAllow={props.onAllowHealth}
      />

      <WeekReview
        entries={props.entries}
        daily={props.daily}
        nights={props.nights}
        stepGoal={props.stepGoal}
        sleepGoal={props.sleepGoal}
      />

      <WeightCard
        heightCm={props.heightCm}
        entries={props.entries}
        latest={props.latest}
        goalKg={props.goalKg}
        onAdd={props.onAddWeight}
        error={props.weightError}
      />

      <SleepCard sleep={props.sleep} sleepMessage={props.sleepMessage} onSave={props.onSaveSleep} />
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: 16 },
    title: { fontSize: 22, fontWeight: '800', color: p.fg },
    card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, gap: 10 },
    center: { alignItems: 'center' },
    stretch: { alignSelf: 'stretch' },
    cardTitle: { fontSize: 16, fontWeight: '800', color: p.fg },
    sub: { fontSize: 13, color: p.muted },
    big: { fontSize: 28, fontWeight: '800', color: p.fg, fontVariant: ['tabular-nums'] },
    link: { color: p.accent, fontSize: 14, fontWeight: '700' },
    error: { color: p.error, fontSize: 13 },
    ringBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
    svg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
    steps: { fontSize: 28, fontWeight: '800', color: p.fg, fontVariant: ['tabular-nums'] },
    trendRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
    change: { fontSize: 14, fontWeight: '700', color: p.muted, fontVariant: ['tabular-nums'] },
    changeDown: { color: p.accent },
    form: { gap: 8 },
    formRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cta: { backgroundColor: p.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
    smallCta: { flex: 1, backgroundColor: p.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
    ctaText: { color: p.onAccent, fontSize: 16, fontWeight: '800' },
    ghostBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: p.line },
    ghostText: { color: p.muted, fontSize: 16, fontWeight: '700' },
  });
