import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette } from './theme';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';
import type { Reminder } from './reminder';

type Props = {
  goalKg: number | null;
  latest: WeightEntry | null;
  onSetGoal: (kg: number | null) => void;
  stepGoal: number;
  onSetStepGoal: (steps: number) => void;
  reminder: Reminder;
  reminderNote: string | null;
  onSetReminder: (r: Reminder) => void;
  onTestReminder: () => void;
};

const REMINDER_HOURS = [20, 21, 22, 23];

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
  latest,
  onSetGoal,
  stepGoal,
  onSetStepGoal,
  reminder,
  reminderNote,
  onSetReminder,
  onTestReminder,
}: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stepInput, setStepInput] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  function save() {
    const kg = parseWeightInput(input);
    if (kg === null) {
      setError('20〜300kgの数字を入力してください。');
      return;
    }
    setError(null);
    setInput('');
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

  const remaining =
    goalKg !== null && latest !== null ? latest.kg - goalKg : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>目標</Text>

      <View style={styles.card}>
        <Text style={styles.label}>毎日のリマインダー</Text>
        <Text style={styles.sub}>
          {reminder.enabled
            ? `毎日 ${reminder.hour}:00 に通知します。`
            : '通知はオフです。'}
        </Text>
        <View style={styles.reminderRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSetReminder({ ...reminder, enabled: !reminder.enabled })}
            style={[styles.reminderBtn, reminder.enabled && styles.reminderBtnOn]}
          >
            <Text style={[styles.reminderText, reminder.enabled && styles.reminderTextOn]}>
              {reminder.enabled ? 'オフにする' : 'オンにする'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.reminderRow}>
          {REMINDER_HOURS.map((h) => (
            <Pressable
              key={h}
              accessibilityRole="button"
              onPress={() => onSetReminder({ ...reminder, enabled: true, hour: h })}
              style={[
                styles.reminderBtn,
                reminder.enabled && reminder.hour === h && styles.reminderBtnOn,
              ]}
            >
              <Text
                style={[
                  styles.reminderText,
                  reminder.enabled && reminder.hour === h && styles.reminderTextOn,
                ]}
              >
                {h}時
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.reminderRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onTestReminder}
            style={styles.reminderBtn}
          >
            <Text style={styles.reminderText}>1分後にテスト通知</Text>
          </Pressable>
        </View>
        {reminderNote ? <Text style={styles.sub}>{reminderNote}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>目標体重</Text>
        <Text style={styles.value}>
          {goalKg !== null ? `${formatWeight(goalKg)} kg` : '未設定'}
        </Text>
        {remaining !== null ? (
          <Text style={styles.sub}>
            {remaining > 0
              ? `現在より あと ${formatWeight(remaining)} kg`
              : '目標に到達しています'}
          </Text>
        ) : (
          <Text style={styles.sub}>体重を記録すると、目標までの差が表示されます。</Text>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              setError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="例: 60.00"
            placeholderTextColor={palette.placeholder}
            accessibilityLabel="目標体重（kg）"
          />
          <Text style={styles.unit}>kg</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

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

      <Text style={styles.sub}>睡眠の目標は次の段階で追加します。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 16,
  },
  reminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
  },
  reminderBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: palette.line,
  },
  reminderBtnOn: {
    backgroundColor: palette.accent,
  },
  reminderText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  reminderTextOn: {
    color: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.fg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  label: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  value: {
    color: palette.fg,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: palette.muted,
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
    backgroundColor: palette.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '800',
    color: palette.fg,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.muted,
  },
  error: {
    color: '#B5523B',
    fontSize: 13,
  },
  cta: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  clear: {
    color: palette.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
