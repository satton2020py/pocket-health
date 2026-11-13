import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Palette, usePalette, useStyles } from './theme';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';
import { forecastGoal, weightTrend } from './trend';
import { WeightInput } from './WeightInput';

type Props = {
  goalKg: number | null;
  entries: WeightEntry[];
  onSetGoal: (kg: number | null) => void;
  stepGoal: number;
  onSetStepGoal: (steps: number) => void;
  // A save failure, shown on this screen.
  error: string | null;
};

// Common daily step goals, so changing the goal is one tap.
const STEP_PRESETS = [6000, 8000, 10000];

// Parses a whole-number step goal. Returns null when it is not a sensible value.
function parseStepGoal(raw: string): number | null {
  const normalized = raw.trim().replace(/,/g, '');
  if (!/^\d{4,6}$/.test(normalized)) return null;
  const steps = Number(normalized);
  if (steps < 1000 || steps > 100000) return null;
  return steps;
}

// Lets the user set a target weight and a daily step goal.
export function GoalScreen({
  goalKg,
  entries,
  onSetGoal,
  stepGoal,
  onSetStepGoal,
  error,
}: Props) {
  const styles = useStyles(makeStyles);
  const palette = usePalette();
  const trend = weightTrend(entries);
  // Starts from the current goal, or the 7-day average minus 3 kg (the project's first goal).
  const [input, setInput] = useState(
    goalKg !== null ? formatWeight(goalKg) : trend ? formatWeight(Math.round((trend.averageKg - 3) * 10) / 10) : '',
  );
  const [inputError, setError] = useState<string | null>(null);
  const [stepInput, setStepInput] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  function save() {
    const kg = parseWeightInput(input);
    if (kg === null) {
      setError('20〜300kgの数字を入力してください。');
      return;
    }
    setError(null);
    onSetGoal(kg);
  }

  function saveSteps() {
    const steps = parseStepGoal(stepInput);
    if (steps === null) {
      setStepError('1,000〜100,000歩の数字を入力してください。');
      return;
    }
    setStepError(null);
    setStepInput('');
    onSetStepGoal(steps);
  }

  // Measured from the 7-day average, the same as the Today screen.
  const remaining = goalKg !== null && trend !== null ? trend.averageKg - goalKg : null;
  const forecast = goalKg !== null ? forecastGoal(entries, goalKg) : null;

  // How far along the way from the first record to the goal the 7-day average is.
  const first =
    entries.length > 0
      ? entries.reduce((a, b) => (a.recordedAt < b.recordedAt ? a : b))
      : null;
  const progress =
    goalKg !== null && first !== null && trend !== null && first.kg > goalKg
      ? Math.min(1, Math.max(0, (first.kg - trend.averageKg) / (first.kg - goalKg)))
      : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>目標</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>目標体重</Text>
        <Text style={styles.value}>
          {goalKg !== null ? `${formatWeight(goalKg)} kg` : '未設定'}
        </Text>
        {remaining !== null ? (
          <Text style={styles.sub}>
            {remaining > 0
              ? `7日間の平均（${formatWeight(trend!.averageKg)} kg）から あと ${formatWeight(remaining)} kg`
              : '目標に到達しています'}
          </Text>
        ) : (
          <Text style={styles.sub}>体重を記録すると、目標までの差が表示されます。</Text>
        )}
        {forecast && remaining !== null && remaining > 0 ? (
          <Text style={styles.sub}>{forecast.message}</Text>
        ) : null}

        {progress !== null && first !== null ? (
          <View style={styles.progressBox}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.sub}>
              最初の記録 {formatWeight(first.kg)} kg から {Math.round(progress * 100)}% 進みました
            </Text>
          </View>
        ) : null}

        <View style={styles.formTop}>
          <WeightInput
            text={input}
            onChange={(text) => {
              setInput(text);
              setError(null);
            }}
            fallbackKg={goalKg ?? trend?.averageKg ?? 60}
            label="目標体重（kg）"
          />
        </View>
        {inputError ? <Text style={styles.error}>{inputError}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          onPress={save}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>目標を設定する</Text>
        </Pressable>
        {goalKg !== null ? (
          <Pressable onPress={() => onSetGoal(null)} accessibilityRole="button">
            <Text style={styles.clear}>目標を消す</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>1日の歩数目標</Text>
        <Text style={styles.value}>{stepGoal.toLocaleString('ja-JP')} 歩</Text>

        <View style={styles.chipRow}>
          {STEP_PRESETS.map((n) => {
            const on = stepGoal === n;
            return (
              <Pressable
                key={n}
                onPress={() => onSetStepGoal(n)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{n.toLocaleString('ja-JP')}歩</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sub}>ほかの歩数にするときは入力してください。</Text>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={stepInput}
            onChangeText={(text) => {
              setStepInput(text);
              setStepError(null);
            }}
            keyboardType="number-pad"
            placeholder="例: 10000"
            placeholderTextColor={palette.placeholder}
            accessibilityLabel="1日の歩数目標"
          />
          <Text style={styles.unit}>歩</Text>
        </View>
        {stepError ? <Text style={styles.error}>{stepError}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          onPress={saveSteps}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>歩数目標を変える</Text>
        </Pressable>
      </View>

      <Text style={styles.sub}>睡眠は1日7時間を目安に、記録タブで確認できます。</Text>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: p.fg,
  },
  card: {
    backgroundColor: p.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  label: {
    color: p.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  value: {
    color: p.fg,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: p.muted,
    fontSize: 13,
  },
  form: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: p.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '800',
    color: p.fg,
    fontVariant: ['tabular-nums'],
  },
  formTop: {
    marginTop: 8,
  },
  progressBox: {
    gap: 6,
    marginTop: 4,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: p.line,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: p.accent,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: p.bg,
    borderWidth: 1,
    borderColor: p.line,
  },
  chipOn: {
    backgroundColor: p.accent,
    borderColor: p.accent,
  },
  chipText: {
    color: p.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextOn: {
    color: p.onAccent,
  },
  unit: {
    fontSize: 18,
    fontWeight: '700',
    color: p.muted,
  },
  error: {
    color: p.error,
    fontSize: 13,
  },
  cta: {
    backgroundColor: p.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: p.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  clear: {
    color: p.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
