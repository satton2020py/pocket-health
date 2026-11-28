import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Palette, usePalette, useStyles } from './theme';
import { formatWeight, parseWeightInput } from './weight';

// A weight field that starts from a given value, with −0.1 and +0.1 buttons on each side.
// Typing directly is still possible. `onChange` receives the raw text.
export function WeightInput({
  text,
  onChange,
  fallbackKg,
  label = '体重（kg）',
}: {
  text: string;
  onChange: (text: string) => void;
  fallbackKg: number;
  label?: string;
}) {
  const styles = useStyles(makeStyles);
  const p = usePalette();

  function step(delta: number) {
    const base = parseWeightInput(text) ?? fallbackKg;
    const next = Math.min(300, Math.max(20, Math.round((base + delta) * 10) / 10));
    onChange(formatWeight(next));
  }

  return (
    <View style={styles.row}>
      <Pressable onPress={() => step(-0.1)} accessibilityRole="button" accessibilityLabel="0.1kg減らす" style={styles.btn}>
        <Text style={styles.btnText}>−0.1</Text>
      </Pressable>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={formatWeight(fallbackKg)}
          placeholderTextColor={p.placeholder}
          accessibilityLabel={label}
          selectTextOnFocus
        />
        <Text style={styles.unit}>kg</Text>
      </View>
      <Pressable onPress={() => step(0.1)} accessibilityRole="button" accessibilityLabel="0.1kg増やす" style={styles.btn}>
        <Text style={styles.btnText}>+0.1</Text>
      </Pressable>
    </View>
  );
}

// Keeps the field text in step with the latest record until the user starts typing.
export function useWeightText(latestKg: number | null): [string, (t: string) => void, () => void] {
  const [text, setText] = useState(latestKg !== null ? formatWeight(latestKg) : '');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && latestKg !== null) setText(formatWeight(latestKg));
  }, [latestKg, touched]);
  return [
    text,
    (t) => {
      setTouched(true);
      setText(t);
    },
    () => setTouched(false),
  ];
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    btn: {
      width: 64,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.bg,
      borderWidth: 1,
      borderColor: p.line,
    },
    btnText: { color: p.accent, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: p.bg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.line,
      paddingHorizontal: 12,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 28,
      fontWeight: '800',
      color: p.fg,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    unit: { fontSize: 16, fontWeight: '700', color: p.muted },
  });
