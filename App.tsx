import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
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
import { SettingsScreen } from './src/SettingsScreen';
import { nightFrom, parseClock, readLastNightSleep, writeSleep } from './src/sleep';
import {
  applyReminder,
  DEFAULT_REMINDER,
  loadReminder,
  scheduleTestReminder,
  type Reminder,
} from './src/reminder';
import { loadLocalGoals, saveLocalGoals } from './src/localGoals';
import { GoalScreen } from './src/GoalScreen';
import { WeightChart } from './src/WeightChart';
import { readRecentSteps, type DailySteps, type StepSource } from './src/healthConnect';
import { onUserChanged, signInWithGoogle, signOut } from './src/auth';
import { deleteWeight, loadWeights, saveWeight } from './src/weightStore';
import { loadLocalWeights, saveLocalWeights } from './src/localWeights';
import { loadGoals, saveGoals } from './src/goalStore';
import type { User } from '@react-native-firebase/auth';
import { palette } from './src/theme';

type Tab = 'today' | 'weight' | 'goal' | 'graph' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [steps, setSteps] = useState(0);
  const [activity, setActivity] = useState({ distanceKm: 0, kcal: 0 });
  const [daily, setDaily] = useState<DailySteps[]>([]);
  const [sources, setSources] = useState<StepSource[]>([]);
  const [stepSource, setStepSource] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [sleep, setSleep] = useState<{ hours: number; start: Date; end: Date } | null>(null);
  const [sleepMessage, setSleepMessage] = useState<string | null>(null);
  const [reminder, setReminder] = useState<Reminder>(DEFAULT_REMINDER);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
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

  // When signed out, show the records kept on this phone.
  useEffect(() => {
    if (user) return;
    loadLocalWeights().then((local) => {
      if (local.length > 0) setEntries(local);
    });
  }, [user]);

  // When someone signs in, move the phone-only entries to the cloud and show the cloud list.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        for (const e of entries) await saveWeight(user.uid, e.kg);
        await saveLocalWeights([]);
        setEntries(await loadWeights(user.uid));
        const saved = await loadGoals(user.uid);
        if (saved) {
          setGoalKg(saved.goalKg);
          setStepGoal(saved.stepGoal);
          // Use the app the user chose by hand last time, if any.
          if (saved.stepSource) syncFromHealthConnect(saved.stepSource);
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
    } else {
      saveLocalGoals({ goalKg: kg, stepGoal });
    }
  }

  function changeStepGoal(steps: number) {
    setStepGoal(steps);
    if (user) {
      saveGoals(user.uid, { goalKg, stepGoal: steps }).catch(() =>
        setError('目標を保存できませんでした。'),
      );
    } else {
      saveLocalGoals({ goalKg, stepGoal: steps });
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

  // Asks first, because a mistyped weight is easy to tap by accident.
  function confirmRemove(id: string) {
    Alert.alert('この記録を削除しますか？', '削除すると元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeEntry(id) },
    ]);
  }

  async function removeEntry(id: string) {
    try {
      if (user) {
        await deleteWeight(user.uid, id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        const next = entries.filter((e) => e.id !== id);
        setEntries(next);
        await saveLocalWeights(next);
      }
    } catch {
      setError('削除できませんでした。もう一度お試しください。');
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
    const next = [
      { id: String(Date.now()), kg, recordedAt: new Date() },
      ...entries,
    ];
    setEntries(next);
    await saveLocalWeights(next);
  }

  // Called only when the user taps an app by hand. Remembers that choice when signed in.
  function selectSource(origin: string) {
    if (user) {
      saveGoals(user.uid, { stepSource: origin }).catch(() =>
        setError('歩数のデータ元を保存できませんでした。'),
      );
    }
    syncFromHealthConnect(origin);
  }

  // Picks which app's steps to use, then re-reads. Only one app is used, so nothing is double counted.
  // Reads last night's sleep. Shown separately, so a sleep problem never hides the steps.
  async function syncSleep() {
    const r = await readLastNightSleep();
    if (r.ok) {
      setSleep(r.night);
      setSleepMessage(r.night ? null : '昨夜の睡眠記録はありません。');
      return;
    }
    setSleep(null);
    setSleepMessage(
      r.reason === 'denied'
        ? '睡眠の読み取りが許可されていません。'
        : '睡眠を取得できませんでした。',
    );
  }

  // Saves a sleep time typed by the user to Health Connect, then shows it on the card.
  // Returns an error message to show in the form, or null when saved.
  async function saveManualSleep(bedText: string, wakeText: string): Promise<string | null> {
    const bed = parseClock(bedText);
    const wake = parseClock(wakeText);
    if (!bed || !wake) return '時刻は 23:30 のように入力してください。';
    const { start, end } = nightFrom(bed, wake);
    const error = await writeSleep(start, end);
    if (error) return error;
    await syncSleep();
    return null;
  }

  // Sends one test notification about a minute from now.
  async function testReminder() {
    setReminderNote(null);
    try {
      const ok = await scheduleTestReminder();
      setReminderNote(
        ok
          ? '1分後にテスト通知が届きます。画面を閉じても届きます。'
          : '通知が許可されていないため、テスト通知を送れません。',
      );
    } catch {
      setReminderNote('テスト通知を設定できませんでした。');
    }
  }

  // Turns the reminder on or off and sets its time. Shows a note when the phone refuses notifications.
  async function changeReminder(r: Reminder) {
    setReminder(r);
    setReminderNote(null);
    try {
      const ok = await applyReminder(r);
      if (!ok) {
        setReminder({ ...r, enabled: false });
        setReminderNote('通知が許可されていないため、リマインダーを設定できません。');
      }
    } catch {
      setReminderNote('リマインダーを設定できませんでした。');
    }
  }

  async function syncFromHealthConnect(preferred: string | null = stepSource) {
    setSyncMessage('Health Connectから取得しています…');
    syncSleep();
    const result = await readRecentSteps(7, preferred);
    if (result.ok) {
      setDaily(result.daily);
      setActivity(result.today);
      setSources(result.sources);
      setStepSource(result.chosen);
      setSteps(result.daily[result.daily.length - 1]?.steps ?? 0);
      setSyncMessage(result.activityDetail ? `距離・カロリー ${result.activityDetail}` : null);
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
    loadReminder().then(setReminder);
    loadLocalGoals().then((local) => {
      if (!local) return;
      setGoalKg(local.goalKg);
      setStepGoal(local.stepGoal);
    });
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
        <Pressable
          onPress={() => setTab('settings')}
          accessibilityRole="tab"
          style={[styles.tab, tab === 'settings' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'settings' && styles.tabTextOn]}>
            設定
          </Text>
        </Pressable>
      </View>

      {tab === 'today' ? (
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
          <TodayScreen
            steps={steps}
            stepGoal={stepGoal}
            daily={daily}
            activity={activity}
            sleep={sleep}
            sleepMessage={sleepMessage}
            onSaveSleep={saveManualSleep}
          />
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
            reminder={reminder}
            reminderNote={reminderNote}
            onSetReminder={changeReminder}
            onTestReminder={testReminder}
          />
        </ScrollView>
      ) : tab === 'settings' ? (
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
          <SettingsScreen
            sources={sources}
            chosen={stepSource}
            onSelectSource={selectSource}
            syncMessage={syncMessage}
            onResync={() => syncFromHealthConnect()}
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
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>{formatWeight(item.kg)} kg</Text>
                  <Pressable
                    onPress={() => confirmRemove(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel="この記録を削除"
                    hitSlop={8}
                  >
                    <Text style={styles.deleteText}>削除</Text>
                  </Pressable>
                </View>
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
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deleteText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
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
