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
import { formatWeight, parseWeightInput, type WeightEntry } from './src/weight';
import { TodayScreen } from './src/TodayScreen';
import { readTodaySteps } from './src/healthConnect';
import { palette } from './src/theme';

type Tab = 'today' | 'weight';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [steps, setSteps] = useState(4210);
  const [stepsInput, setStepsInput] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
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

  async function syncFromHealthConnect() {
    setSyncMessage('Health Connectから取得しています…');
    const result = await readTodaySteps();
    if (result.ok) {
      setSteps(result.steps);
      setSyncMessage(null);
      return;
    }
    const text =
      result.reason === 'denied'
        ? '歩数の読み取りが許可されていません。下の欄から手入力できます。'
        : result.reason === 'unsupported'
          ? 'このデバイスでは使えません。下の欄から手入力できます。'
          : 'Health Connectから取得できませんでした。下の欄から手入力できます。';
    setSyncMessage(result.detail ? `${text}（${result.detail}）` : text);
  }

  function applySteps() {
    const n = Number(stepsInput.replace(/,/g, ''));
    if (!Number.isInteger(n) || n < 0 || n > 100000) return;
    setSteps(n);
    setStepsInput('');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('today')}
          accessibilityRole="tab"
          style={[styles.tab, tab === 'today' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'today' && styles.tabTextOn]}>
            今日
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('weight')}
          accessibilityRole="tab"
          style={[styles.tab, tab === 'weight' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'weight' && styles.tabTextOn]}>
            体重
          </Text>
        </Pressable>
      </View>

      {tab === 'today' ? (
        <>
          <TodayScreen steps={steps} />
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { fontSize: 18 }]}
              value={stepsInput}
              onChangeText={setStepsInput}
              onSubmitEditing={applySteps}
              keyboardType="number-pad"
              placeholder="歩数を入力"
              placeholderTextColor={palette.muted}
              accessibilityLabel="歩数"
            />
            <Pressable
              style={styles.smallBtn}
              onPress={applySteps}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>反映</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.smallBtn}
            onPress={syncFromHealthConnect}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Health Connectから取得</Text>
          </Pressable>
          {syncMessage ? <Text style={styles.muted}>{syncMessage}</Text> : null}
        </>
      ) : (
        <>
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
        </>
      )}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: palette.line,
    borderRadius: 999,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabOn: {
    backgroundColor: palette.surface,
  },
  tabText: {
    color: palette.muted,
    fontWeight: '700',
  },
  tabTextOn: {
    color: palette.fg,
  },
  smallBtn: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
