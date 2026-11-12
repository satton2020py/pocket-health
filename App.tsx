import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
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
import { readRecentSteps, type DailySteps } from './src/healthConnect';
import { onUserChanged, signInWithGoogle, signOut } from './src/auth';
import { loadWeights, saveWeight } from './src/weightStore';
import { loadGoals, saveGoals } from './src/goalStore';
import type { User } from '@react-native-firebase/auth';
import { palette } from './src/theme';

type Tab = 'today' | 'weight' | 'goal' | 'graph';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [steps, setSteps] = useState(0);
  const [daily, setDaily] = useState<DailySteps[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Goals. Saved to the cloud when signed in, otherwise they last only until the app closes.
  const [goalKg, setGoalKg] = useState<number | null>(null);
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
        const saved = await loadGoals(user.uid);
        if (saved) {
          setGoalKg(saved.goalKg);
          setStepGoal(saved.stepGoal);
        }
        setError(null);
      } catch {
        setError('クラウドから読み込めませんでした。');
      }
    })();
    // Run only when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Updates a goal on screen and, when signed in, saves it to the cloud.
  function changeGoalKg(kg: number | null) {
    setGoalKg(kg);
    if (user) {
      saveGoals(user.uid, { goalKg: kg, stepGoal }).catch(() =>
        setError('目標を保存できませんでした。'),
      );
    }
  }

  function changeStepGoal(steps: number) {
    setStepGoal(steps);
    if (user) {
      saveGoals(user.uid, { goalKg, stepGoal: steps }).catch(() =>
        setError('目標を保存できませんでした。'),
      );
    }
  }

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
    const result = await readRecentSteps(7);
    if (result.ok) {
      setDaily(result.daily);
      setSteps(result.daily[result.daily.length - 1]?.steps ?? 0);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
          <TodayScreen steps={steps} stepGoal={stepGoal} daily={daily} />
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
        <ScrollView
          contentContainerStyle={{ gap: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <GoalScreen
            goalKg={goalKg}
            latest={latestEntry}
            onSetGoal={changeGoalKg}
            stepGoal={stepGoal}
            onSetStepGoal={changeStepGoal}
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
              placeholderTextColor={palette.placeholder}
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
                  {item.recordedAt.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.rowValue}>{formatWeight(item.kg)} kg</Text>
              </View>
            )}
          />
        </>
      )}
    </KeyboardAvoidingView>
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
