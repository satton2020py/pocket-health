import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { type Palette, usePalette, useStyles } from './theme';
import { type Clock, clockText, DateTimePicker, dayLabel, nowClock, QuickTime } from './pickers';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';
import { useWeightText, WeightInput } from './WeightInput';
import { weightTrend } from './trend';
import { bmi, bmiLabel, milestones, recordStreak, weekKey } from './insights';
import type { DailySteps } from './healthConnect';
import type { SleepNight } from './sleep';
import { sleepReached, stepMedal, streakSummary, weekResults, weightUnits } from './achievements';
import { MedalCard, type TodayAchievements } from './AchievementCards';

export const DEFAULT_STEP_GOAL = 8000;

// How many days the Today tab can show, counting today. Steps and sleep are read for this many days.
export const HISTORY_DAYS = 30;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// The `days` items of a day-by-day list (oldest first) that end on `day`.
function endingOn<T extends { date: Date }>(list: T[], day: Date, days: number): T[] {
  const i = list.findIndex((x) => sameDay(x.date, day));
  return i < 0 ? [] : list.slice(Math.max(0, i - days + 1), i + 1);
}

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
  // The same, for the last HISTORY_DAYS days, so a past day can be shown.
  dailyAll: DailySteps[];
  nightsAll: SleepNight[];
  // Days back from today that the screen shows. 0 is today.
  dayOffset: number;
  onChangeDay: (offset: number) => void;
  sleepGoal: number;
  onAllowHealth: () => void;
  activity: { distanceKm: number; kcal: number };
  sleep: { hours: number; start: Date; end: Date } | null;
  sleepMessage: string | null;
  // `day` is the morning the night ended on, or null for last night.
  onSaveSleep: (bed: Clock, wake: Clock, day: Date | null) => Promise<string | null>;
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
// On a past day, the time starts on that day at the current time of day, and the card
// also lists what was recorded that day.
function WeightCard({
  entries,
  latest,
  goalKg,
  heightCm,
  onAdd,
  error,
  day,
  dayEntries,
}: {
  entries: WeightEntry[];
  heightCm: number | null;
  latest: WeightEntry | null;
  goalKg: number | null;
  onAdd: Props['onAddWeight'];
  error: string | null;
  day: Date | null;
  dayEntries: WeightEntry[];
}) {
  const styles = useStyles(makeStyles);
  const [text, setText, resetText] = useWeightText(latest?.kg ?? null);
  const pastAt = () => {
    if (!day) return null;
    const now = new Date();
    const d = new Date(day);
    d.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return d;
  };
  const [at, setAt] = useState<Date | null>(pastAt);
  // On a past day the time is always set, so the picker opens on its own.
  const [picking, setPicking] = useState(false);
  const showPicker = day ? picking : at !== null;
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
      setAt(pastAt());
      setPicking(false);
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

      {day ? (
        <Text style={styles.sub}>
          この日の記録：
          {dayEntries.length > 0
            ? dayEntries.map((e) => `${formatWeight(e.kg)} kg（${timeOf(e.recordedAt)}）`).join('、')
            : 'まだありません'}
        </Text>
      ) : null}

      <Pressable
        onPress={() => (day ? setPicking(!picking) : setAt(at ? null : new Date()))}
        accessibilityRole="button"
        hitSlop={6}
      >
        <Text style={styles.link}>
          日時：{at ? `${dayLabel(at)} ${timeOf(at)}` : '今'}　
          {day ? (picking ? '閉じる' : '変える') : at ? '今に戻す' : '変える'}
        </Text>
      </Pressable>
      {showPicker && at ? <DateTimePicker value={at} onChange={setAt} /> : null}

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

const LAST_SLEEP_KEY = 'sleep.lastManual.v1';

const clockOf = (d: Date): Clock => ({ h: d.getHours(), m: d.getMinutes() });

// Hours between a bedtime and a wake-up time, as nightFrom would save them.
function hoursBetween(bed: Clock, wake: Clock): number {
  const mins = (((wake.h * 60 + wake.m - (bed.h * 60 + bed.m)) % 1440) + 1440) % 1440;
  return (mins === 0 ? 1440 : mins) / 60;
}

// Where the form starts: the last time typed by hand, else the latest night from
// Health Connect, else 23:00 to 7:00.
async function initialTimes(nights: SleepNight[]): Promise<{ bed: Clock; wake: Clock } | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SLEEP_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v?.bed && v?.wake) return { bed: v.bed, wake: v.wake };
    }
  } catch {
    // Fall through to Health Connect.
  }
  const last = [...nights].reverse().find((n) => n.start && n.end);
  if (last?.start && last.end) return { bed: clockOf(last.start), wake: clockOf(last.end) };
  return null;
}

// Last night's sleep. With nothing recorded yet, the card offers last time's bedtime and
// wake-up time so one tap on "この時間で記録" saves it; "時刻を変える" opens quick buttons.
// On a past day it shows and saves the night that ended on that morning.
function SleepCard({
  sleep,
  sleepMessage,
  nights,
  onSave,
  day,
}: {
  sleep: Props['sleep'];
  sleepMessage: string | null;
  nights: SleepNight[];
  onSave: (bed: Clock, wake: Clock) => Promise<string | null>;
  day: Date | null;
}) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [bed, setBed] = useState<Clock>({ h: 23, m: 0 });
  const [wake, setWake] = useState<Clock>({ h: 7, m: 0 });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fill in the starting times once, unless the user has already changed them.
  useEffect(() => {
    if (touched) return;
    let alive = true;
    initialTimes(nights).then((t) => {
      if (alive && t) {
        setBed(t.bed);
        setWake(t.wake);
      }
    });
    return () => {
      alive = false;
    };
  }, [nights, touched]);

  const changeBed = (c: Clock) => {
    setTouched(true);
    setBed(c);
  };
  const changeWake = (c: Clock) => {
    setTouched(true);
    setWake(c);
  };

  async function save() {
    setBusy(true);
    const result = await onSave(bed, wake);
    setBusy(false);
    setError(result);
    if (!result) {
      setOpen(false);
      setSaved(true);
      try {
        await AsyncStorage.setItem(LAST_SLEEP_KEY, JSON.stringify({ bed, wake }));
      } catch {
        // Only a starting point for next time; saving it is not essential.
      }
    }
  }

  const hours = hoursBetween(bed, wake);
  const summary = `${clockText(bed)} 〜 ${clockText(wake)}（${hours.toFixed(1)}時間）`;
  const saveButton = (
    <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={styles.cta}>
      <Text style={styles.ctaText}>{busy ? '保存中…' : 'この時間で記録'}</Text>
    </Pressable>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{day ? `${dayLabel(day)}の朝までの睡眠` : '昨夜の睡眠'}</Text>
      {sleep ? (
        <>
          <Text style={styles.big}>{sleep.hours.toFixed(1)} 時間</Text>
          <Text style={styles.sub}>
            {timeOf(sleep.start)} 〜 {timeOf(sleep.end)}
            {saved ? '　記録しました' : ''}
          </Text>
        </>
      ) : (
        <Text style={styles.sub}>
          {saved ? '記録しました。' : (sleepMessage ?? '読み込み中…')}
        </Text>
      )}

      {open ? (
        <View style={styles.form}>
          <QuickTime label="就寝" value={bed} onChange={changeBed} />
          <QuickTime
            label="起床"
            value={wake}
            onChange={changeWake}
            extra={{ label: '今', onPress: () => changeWake(nowClock()) }}
          />
          <Text style={styles.sub}>{hours.toFixed(1)}時間 眠ったことになります</Text>
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
      ) : sleep || saved ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.link}>手で入力</Text>
        </Pressable>
      ) : (
        <View style={styles.form}>
          <Text style={styles.quickSummary}>{summary}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saveButton}
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.link}>時刻を変える</Text>
          </Pressable>
        </View>
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

// Steps for the shown day. When Health Connect is not allowed, it says so and offers the
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

// Today's steps medal, last night's sleep, and this week's weight change in 500 g steps.
export function todayGoals(p: {
  steps: number;
  stepGoal: number;
  stepsStatus: StepsStatus;
  sleep: { hours: number } | null;
  sleepGoal: number;
  entries: WeightEntry[];
}): TodayAchievements {
  const change = weightTrend(p.entries)?.weekChangeKg ?? null;
  const known = p.stepsStatus === 'ok';
  return {
    steps: known ? p.steps : null,
    stepGoal: p.stepGoal,
    stepMedal: known ? stepMedal(p.steps, p.stepGoal) : null,
    sleepHours: p.sleep?.hours ?? null,
    sleepGoal: p.sleepGoal,
    sleepReached: sleepReached(p.sleep?.hours, p.sleepGoal),
    weekChangeKg: change,
    weightUnits: weightUnits(change),
  };
}

// Three cards: steps, then the weight entry, then last night's sleep.
// The 7-day charts are on the 記録 tab. The arrows by the title go back to a past day,
// up to HISTORY_DAYS days, so a forgotten weight or night can be filled in and seen.
export function TodayScreen(props: Props) {
  const styles = useStyles(makeStyles);
  const offset = Math.min(Math.max(props.dayOffset, 0), HISTORY_DAYS - 1);
  const isToday = offset === 0;
  const day = startOfDay(new Date());
  day.setDate(day.getDate() - offset);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  const past = isToday ? null : day;

  // Everything is shown as it stood at the end of the chosen day.
  const entries = isToday ? props.entries : props.entries.filter((e) => e.recordedAt <= dayEnd);
  const latest = isToday
    ? props.latest
    : entries.length > 0
      ? entries.reduce((a, b) => (a.recordedAt > b.recordedAt ? a : b))
      : null;
  const dayEntries = props.entries
    .filter((e) => sameDay(e.recordedAt, day))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const steps = isToday ? props.steps : (props.dailyAll.find((d) => sameDay(d.date, day))?.steps ?? 0);
  // Distance and calories are read for today only.
  const activity = isToday ? props.activity : { distanceKm: 0, kcal: 0 };

  const night = props.nightsAll.find((n) => sameDay(n.date, day));
  const sleep = isToday
    ? props.sleep
    : night && night.hours > 0 && night.start && night.end
      ? { hours: night.hours, start: night.start, end: night.end }
      : null;
  const sleepMessage = isToday
    ? props.sleepMessage
    : props.nightsAll.length > 0
      ? 'この日の睡眠記録はありません。'
      : props.sleepMessage;

  const week = weekResults(
    isToday ? props.daily : endingOn(props.dailyAll, day, 7),
    isToday ? props.nights : endingOn(props.nightsAll, day, 7),
    props.stepGoal,
    props.sleepGoal,
  );

  const go = (next: number) => props.onChangeDay(Math.min(Math.max(next, 0), HISTORY_DAYS - 1));
  const canBack = offset < HISTORY_DAYS - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.dayRow}>
        <Pressable
          onPress={() => go(offset + 1)}
          disabled={!canBack}
          accessibilityRole="button"
          accessibilityLabel="前の日"
          hitSlop={6}
          style={[styles.dayArrow, !canBack && styles.disabled]}
        >
          <Text style={styles.dayArrowText}>‹</Text>
        </Pressable>
        <Text style={[styles.title, styles.dayTitle]}>
          {isToday ? `今日 ${dayLabel(day)}` : dayLabel(day)}
        </Text>
        <Pressable
          onPress={() => go(offset - 1)}
          disabled={isToday}
          accessibilityRole="button"
          accessibilityLabel="次の日"
          hitSlop={6}
          style={[styles.dayArrow, isToday && styles.disabled]}
        >
          <Text style={styles.dayArrowText}>›</Text>
        </Pressable>
      </View>
      {!isToday ? (
        <View style={styles.pastBar}>
          <Text style={[styles.sub, styles.flex]}>
            {offset === 1 ? '昨日' : `${offset}日前`}の記録を見ています。体重と睡眠はこの日の分として記録されます。
          </Text>
          <Pressable onPress={() => go(0)} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.link}>今日に戻る</Text>
          </Pressable>
        </View>
      ) : null}

      <StepsCard
        steps={steps}
        stepGoal={props.stepGoal}
        status={props.stepsStatus}
        activity={activity}
        onAllow={props.onAllowHealth}
      />

      <MedalCard
        today={todayGoals({ ...props, entries, steps, sleep })}
        week={week}
        streak={streakSummary(entries, isToday ? new Date() : dayEnd)}
        day={past}
      />

      {isToday ? (
        <WeekReview
          entries={props.entries}
          daily={props.daily}
          nights={props.nights}
          stepGoal={props.stepGoal}
          sleepGoal={props.sleepGoal}
        />
      ) : null}

      <WeightCard
        key={`w-${day.toDateString()}`}
        heightCm={props.heightCm}
        entries={entries}
        latest={latest}
        goalKg={props.goalKg}
        onAdd={props.onAddWeight}
        error={props.weightError}
        day={past}
        dayEntries={dayEntries}
      />

      <SleepCard
        key={`s-${day.toDateString()}`}
        sleep={sleep}
        sleepMessage={sleepMessage}
        nights={props.nightsAll}
        onSave={(bed, wake) => props.onSaveSleep(bed, wake, past)}
        day={past}
      />
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: 16 },
    flex: { flex: 1 },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dayTitle: { flex: 1, textAlign: 'center' },
    dayArrow: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surface,
    },
    dayArrowText: { color: p.accent, fontSize: 26, fontWeight: '800', lineHeight: 30 },
    disabled: { opacity: 0.3 },
    pastBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: p.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
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
    quickSummary: { fontSize: 18, fontWeight: '700', color: p.fg, fontVariant: ['tabular-nums'] },
    formRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cta: { backgroundColor: p.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
    smallCta: { flex: 1, backgroundColor: p.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
    ctaText: { color: p.onAccent, fontSize: 16, fontWeight: '800' },
    ghostBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: p.line },
    ghostText: { color: p.muted, fontSize: 16, fontWeight: '700' },
  });
