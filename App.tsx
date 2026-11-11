import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatWeight,
  parseWeightInput,
  type WeightEntry,
} from './src/weight';

const palette = {
  bg: '#F7F4EC',
  surface: '#FFFFFF',
  fg: '#2B2F2A',
  muted: '#7A8077',
  accent: '#5E9C7A',
  line: '#E7E2D6',
};

export default function App() {
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  function record() {
    const kg = parseWeightInput(input);
    if (kg === null) {
      setError('kgの数字を入力してください（小数点2位まで）。');
      return;
    }
    setEntries((prev) => [
      { id: String(Date.now()), kg, recordedAt: new Date() },
      ...prev,
    ]);
    setInput('');
    setError(null);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>体重を記録</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(text) => {
            setInput(text);
            setError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="62.45"
          placeholderTextColor={palette.muted}
          accessibilityLabel="体重（kg）"
        />
        <Text style={styles.unit}>kg</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        onPress={record}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>記録する</Text>
      </Pressable>

      <FlatList
        style={styles.list}
        data={entries}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.muted}>まだ記録がありません。</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowDate}>
              {item.recordedAt.toLocaleDateString('ja-JP')}
            </Text>
            <Text style={styles.rowValue}>{formatWeight(item.kg)} kg</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingTop: 72,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.fg,
  },
  form: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 28,
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
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  rowDate: {
    color: palette.muted,
    fontSize: 14,
  },
  rowValue: {
    color: palette.fg,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  muted: {
    color: palette.muted,
    textAlign: 'center',
    marginTop: 24,
  },
});
