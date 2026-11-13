import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { type Palette, usePalette, useStyles } from './theme';
import type { DailySteps } from './healthConnect';
import { type Clock, clockText, DateTimePicker, dayLabel, TimePicker } from './pickers';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';
import { useWeightText, WeightInput } from './WeightInput';

export const DEFAULT_STEP_GOAL = 8000;

type Props = {
  latest: WeightEntry | null;
  goalKg: number | null;
  onAddWeight: (kg: number, at: Date) => Promise<boolean>;
  weightError: string | null;
  steps: number;
  stepGoal: number;
  daily: DailySteps[];
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
  latest,
  goalKg,
  onAdd,
  error,
}: {
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

  const remaining = goalKg !== null && latest !== null ? latest.kg - goalKg : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>体重</Text>
      {latest ? (
        <Text style={styles.sub}>
          前回 {formatWeight(latest.kg)} kg（{dayLabel(latest.recordedAt)} {timeOf(latest.recordedAt)}）
          {remaining !== null
            ? remaining > 0
              ? ` ／ 目標まであと ${formatWeight(remaining)} kg`
              : ' ／ 目標に到達しています'
            : ''}
        </Text>
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

const CHART_H = 140;
const BAR_W = 22;

// Weight first (the main goal), then steps and last night's sleep.
export function TodayScreen(props: Props) {
  const { steps, stepGoal, daily, activity } = props;
  const styles = useStyles(makeStyles);
  const p = usePalette();
  const { width: windowWidth } = useWindowDimensions();

  // The ring stops at a full circle, but the percentage keeps counting past 100%.
  const ratio = Math.min(steps / stepGoal, 1);
  const percent = Math.round((steps / stepGoal) * 100);
  const size = 160;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Average over the days that have any steps, so an unsynced day does not pull it down.
  const withData = daily.filter((d) => d.steps > 0);
  const average =
    withData.length > 0
      ? Math.round(withData.reduce((s, d) => s + d.steps, 0) / withData.length)
      : 0;
  const reachedDays = daily.filter((d) => d.steps >= stepGoal).length;

  const chartMax = Math.max(stepGoal, ...daily.map((d) => d.steps)) * 1.1;
  const barY = (v: number) => CHART_H - (v / chartMax) * CHART_H;
  // Screen padding (20 each side) and card padding (16 each side).
  const chartW = Math.max(240, windowWidth - 72);
  const slot = chartW / Math.max(daily.length, 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>今日 {dayLabel(new Date())}</Text>

      <WeightCard
        latest={props.latest}
        goalKg={props.goalKg}
        onAdd={props.onAddWeight}
        error={props.weightError}
      />

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
          目標 {stepGoal.toLocaleString('ja-JP')}歩 ｜ {activity.distanceKm.toFixed(2)} km ｜{' '}
          {Math.round(activity.kcal).toLocaleString('ja-JP')} kcal
        </Text>
      </View>

      <SleepCard sleep={props.sleep} sleepMessage={props.sleepMessage} onSave={props.onSaveSleep} />

      {daily.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>過去7日間の歩数</Text>
          <Text style={styles.sub}>
            平均 {average.toLocaleString('ja-JP')}歩 ／ 目標達成 {reachedDays}/{daily.length}日
          </Text>
          <Svg width={chartW} height={CHART_H + 26}>
            <Line
              x1={0}
              x2={chartW}
              y1={barY(stepGoal)}
              y2={barY(stepGoal)}
              stroke={p.accent}
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <SvgText x={chartW} y={barY(stepGoal) - 6} fontSize={11} fill={p.accent} textAnchor="end">
              目標 {stepGoal.toLocaleString('ja-JP')}
            </SvgText>
            {daily.map((d, i) => {
              const h = (d.steps / chartMax) * CHART_H;
              const cx = i * slot + slot / 2;
              const reached = d.steps >= stepGoal;
              const isToday = i === daily.length - 1;
              return (
                <G key={i}>
                  <Rect
                    x={cx - BAR_W / 2}
                    y={CHART_H - h}
                    width={BAR_W}
                    height={Math.max(h, 2)}
                    rx={BAR_W / 2}
                    fill={reached ? p.accent : p.accentSoft}
                  />
                  <SvgText
                    x={cx}
                    y={Math.max(CHART_H - h, 12) - 6}
                    fontSize={11}
                    fontWeight="700"
                    fill={p.fg}
                    textAnchor="middle"
                  >
                    {d.steps.toLocaleString('ja-JP')}
                  </SvgText>
                  <SvgText
                    x={cx}
                    y={CHART_H + 18}
                    fontSize={12}
                    fontWeight={isToday ? '800' : '400'}
                    fill={isToday ? p.fg : p.muted}
                    textAnchor="middle"
                  >
                    {d.date.getDate()}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      ) : null}
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
    ringBox: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
    svg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
    steps: { fontSize: 32, fontWeight: '800', color: p.fg, fontVariant: ['tabular-nums'] },
    form: { gap: 8 },
    formRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cta: { backgroundColor: p.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
    smallCta: { flex: 1, backgroundColor: p.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
    ctaText: { color: p.onAccent, fontSize: 16, fontWeight: '800' },
    ghostBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: p.line },
    ghostText: { color: p.muted, fontSize: 16, fontWeight: '700' },
  });
