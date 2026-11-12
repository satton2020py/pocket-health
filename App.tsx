import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatWeight, parseWeightInput, type WeightEntry } from './src/weight';
import { DEFAULT_STEP_GOAL, TodayScreen } from './src/TodayScreen';
import { GoalScreen } from './src/GoalScreen';
import { WeightChart } from './src/WeightChart';
import { readTodaySteps } from './src/healthConnect';
import { onUserChanged, signInWithGoogle, signOut } from './src/auth';
import { loadWeights, saveWeight } from './src/weightStore';
import type { User } from '@react-native-firebase/auth';
import { palette } from './src/theme';

type Tab = 'today' | 'weight' | 'goal' | 'graph';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [steps, setSteps] = useState(4210);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Target weight. Kept in memory for now, so it resets when the app restarts.
  const [goalKg, setGoalKg] = useState<number | null>(null);
  // Daily step goal. Also kept in memory for now.
  const [stepGoal, setStepGoal] = useState(DEFAULT_STEP_GOAL);

  const [user, setUser] = useState<User | null>(null);

  const latestEntry =
    entries.length > 0
      ? entries.reduce((a, b) => (a.recordedAt > b.recordedAt ? a : b))
      : null;

  useEffect(() => onUserChanged(setUser), []);

  // When someone signs in, move the phone-only entries to the cloud and show the cloud list.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        for (const e of entries) await saveWeight(user.uid, e.kg);
        setEntries(await loadWeights(user.uid));
        setError(null);
      } catch {
        setError('クラウドから読み込めませんでした。');
      }
    })();
    // Run only when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function login() {
    try {
      const signed = await signInWithGoogle();
      if (signed) setUser(signed);
    } catch {
      setError('ログインできませんでした。もう一度お試しください。');
    }
  }

  async function logout() {
    await signOut();
    setEntries([]);
    setUser(null);
  }

  async function record() {
    const kg = parseWeightInput(input);
    if (kg === null) {
      setError('kgの数字を入力してください（小数点2位まで）。');
      return;
    }
    setInput('');
    setError(null);
    if (user) {
      try {
        await saveWeight(user.uid, kg);
        setEntries(await loadWeights(user.uid));
      } catch {
        setError('保存できませんでした。もう一度お試しください。');
      }
      return;
    }
    setEntries((prev) => [
      { id: String(Date.now()), kg, recordedAt: new Date() },
      ...prev,
    ]);
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
        ? '歩数の読み取りが許可されていません。'
        : result.reason === 'unsupported'
          ? 'このデバイスでは使えません。'
          : 'Health Connectから取得できませんでした。';
    setSyncMessage(result.detail ? `${text}（${result.detail}）` : text);
  }

  useEffect(() => {
    syncFromHealthConnect();
  }, []);

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
        <Pressable
          onPress={() => setTab('goal')}
          accessibilityRole="tab"
          style={[styles.tab, tab === 'goal' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'goal' && styles.tabTextOn]}>
            目標
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('graph')}
          accessibilityRole="tab"
          style={[styles.tab, tab === 'graph' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'graph' && styles.tabTextOn]}>
            グラフ
          </Text>
        </Pressable>
      </View>

      {tab === 'today' ? (
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
          <TodayScreen steps={steps} stepGoal={stepGoal} />
          <Pressable
            style={styles.smallBtn}
            onPress={syncFromHealthConnect}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Health Connectから再取得</Text>
          </Pressable>
          {syncMessage ? <Text style={styles.muted}>{syncMessage}</Text> : null}
        </ScrollView>
      ) : tab === 'goal' ? (
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
          <GoalScreen
            goalKg={goalKg}
            latest={latestEntry}
            onSetGoal={setGoalKg}
            stepGoal={stepGoal}
            onSetStepGoal={setStepGoal}
          />
        </ScrollView>
      ) : tab === 'graph' ? (
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
          <WeightChart entries={entries} goalKg={goalKg} />
        </ScrollView>
      ) : (
        <>
          <View style={styles.authRow}>
            <Text style={styles.authText}>
              {user ? 'ログイン中（クラウドに保存）' : 'ログインすると機種変後も残ります'}
            </Text>
            <Pressable
              style={styles.smallBtn}
              onPress={user ? logout : login}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>{user ? 'ログアウト' : 'Googleでログイン'}</Text>
            </Pressable>
          </View>
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
    paddingBottom: 40,
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
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  authText: {
    flex: 1,
    color: palette.muted,
    fontSize: 13,
  },
  smallBtn: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
