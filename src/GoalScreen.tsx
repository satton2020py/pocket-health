import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette } from './theme';
import { STEP_GOAL } from './TodayScreen';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';

type Props = {
  goalKg: number | null;
  latest: WeightEntry | null;
  onSetGoal: (kg: number | null) => void;
};

// Lets the user set a target weight and shows how far they are from it.
export function GoalScreen({ goalKg, latest, onSetGoal }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const remaining =
    goalKg !== null && latest !== null ? latest.kg - goalKg : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>目標</Text>

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
            placeholderTextColor={palette.muted}
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
        <Text style={styles.value}>{STEP_GOAL.toLocaleString('ja-JP')} 歩</Text>
        <Text style={styles.sub}>今はアプリで固定しています。</Text>
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
