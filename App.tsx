import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import type { WeightEntry } from './src/weight';
import { DEFAULT_STEP_GOAL, TodayScreen, type StepsStatus } from './src/TodayScreen';
import { DEFAULT_SLEEP_GOAL } from './src/GoalScreen';
import { RecordsScreen } from './src/RecordsScreen';
import { GoalScreen } from './src/GoalScreen';
import { SettingsScreen } from './src/SettingsScreen';
import { OnboardingScreen } from './src/OnboardingScreen';
import { nightFrom, readLastNightSleep, readSleepHistory, writeSleep, type SleepNight } from './src/sleep';
import type { Clock } from './src/pickers';
import {
  DEFAULT_REMINDER,
  ensureNotificationPermission,
  loadReminder,
  scheduleReminders,
  scheduleTestReminder,
  storeReminder,
  type Reminder,
} from './src/reminder';
import { loadLocalGoals, saveLocalGoals } from './src/localGoals';
import {
  readRecentSteps,
  requestHealthPermissions,
  type DailySteps,
  type StepSource,
} from './src/healthConnect';
import { onUserChanged, signInWithGoogle, signOut } from './src/auth';
import { deleteWeight, loadWeights, saveWeight, updateWeight } from './src/weightStore';
import { loadLocalWeights, saveLocalWeights } from './src/localWeights';
import { loadGoals, saveGoals } from './src/goalStore';
import { loadOnboarded, saveOnboarded } from './src/onboarding';
import type { User } from '@react-native-firebase/auth';
import { type Palette, usePalette, useStyles } from './src/theme';
import { GoalIcon, RecordsIcon, SettingsIcon, TodayIcon } from './src/icons';

type Tab = 'today' | 'records' | 'goal' | 'settings';

const TABS: { key: Tab; label: string; Icon: ComponentType<{ color: string }> }[] = [
  { key: 'today', label: '今日', Icon: TodayIcon },
  { key: 'records', label: '記録', Icon: RecordsIcon },
  { key: 'goal', label: '目標', Icon: GoalIcon },
  { key: 'settings', label: '設定', Icon: SettingsIcon },
];

const byNewest = (list: WeightEntry[]) =>
  [...list].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

export default function App() {
  const styles = useStyles(makeStyles);
  const palette = usePalette();
  const [tab, setTab] = useState<Tab>('today');
  // null until the first-run flag is read from the phone.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  const [steps, setSteps] = useState(0);
  const [activity, setActivity] = useState({ distanceKm: 0, kcal: 0 });
  const [daily, setDaily] = useState<DailySteps[]>([]);
  const [sources, setSources] = useState<StepSource[]>([]);
  const [stepSource, setStepSource] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [stepsStatus, setStepsStatus] = useState<StepsStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  // True while Health Connect is being read, so a pull and a return to the app do not read twice at once.
  const syncing = useRef(false);
  // The tabs share one scroll view, so it goes back to the top when the tab changes.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [sleep, setSleep] = useState<{ hours: number; start: Date; end: Date } | null>(null);
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [sleepMessage, setSleepMessage] = useState<string | null>(null);
  const [reminder, setReminder] = useState<Reminder>(DEFAULT_REMINDER);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  // False until the saved setting is read, so the default (off) never cancels saved reminders.
  const reminderLoaded = useRef(false);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  // Each screen shows its own errors, so a failure appears where it happened.
  const [weightError, setWeightError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [goalKg, setGoalKg] = useState<number | null>(null);
  const [stepGoal, setStepGoal] = useState(DEFAULT_STEP_GOAL);
  const [sleepGoal, setSleepGoal] = useState(DEFAULT_SLEEP_GOAL);

  const [user, setUser] = useState<User | null>(null);

  const latestEntry =
    entries.length > 0
      ? entries.reduce((a, b) => (a.recordedAt > b.recordedAt ? a : b))
      : null;

  useEffect(() => onUserChanged(setUser), []);

  // When signed out, show the records kept on this phone.
  useEffect(() => {
    if (user) return;
    loadLocalWeights().then(setEntries);
  }, [user]);

  // When someone signs in, move the phone-only records to the cloud with their original
  // date and time, then show the cloud list. Each moved record is removed from the phone
  // right away, so a failure part-way through never uploads the same record twice.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        let remaining = await loadLocalWeights();
        for (const e of [...remaining]) {
          await saveWeight(user.uid, e.kg, e.recordedAt);
          remaining = remaining.filter((r) => r.id !== e.id);
          await saveLocalWeights(remaining);
        }
        setEntries(await loadWeights(user.uid));
        const saved = await loadGoals(user.uid);
        if (saved) {
          setGoalKg(saved.goalKg);
          setStepGoal(saved.stepGoal);
          setSleepGoal(saved.sleepGoal);
          // Use the app the user chose by hand last time, if any.
          if (saved.stepSource) syncFromHealthConnect(saved.stepSource);
        } else {
          // First sign-in: keep the goals set on this phone.
          await saveGoals(user.uid, { goalKg, stepGoal, sleepGoal });
        }
        setSettingsError(null);
      } catch {
        setSettingsError('クラウドとのやり取りに失敗しました。通信を確認して、もう一度ログインしてください。');
      }
    })();
    // Run only when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Updates goals on screen and saves them to the cloud when signed in, otherwise to the phone.
  function persistGoals(next: { goalKg: number | null; stepGoal: number; sleepGoal: number }) {
    setGoalError(null);
    if (user) {
      saveGoals(user.uid, next).catch(() => setGoalError('目標を保存できませんでした。'));
    } else {
      saveLocalGoals(next);
    }
  }

  function changeGoalKg(kg: number | null) {
    setGoalKg(kg);
    persistGoals({ goalKg: kg, stepGoal, sleepGoal });
  }

  function changeStepGoal(next: number) {
    setStepGoal(next);
    persistGoals({ goalKg, stepGoal: next, sleepGoal });
  }

  function changeSleepGoal(next: number) {
    setSleepGoal(next);
    persistGoals({ goalKg, stepGoal, sleepGoal: next });
  }

  // Shows the goals kept on this phone, or the defaults when there are none.
  async function showLocalGoals() {
    const local = await loadLocalGoals();
    setGoalKg(local?.goalKg ?? null);
    setStepGoal(local?.stepGoal ?? DEFAULT_STEP_GOAL);
    setSleepGoal(local?.sleepGoal ?? DEFAULT_SLEEP_GOAL);
  }

  async function login() {
    try {
      setSettingsError(null);
      const signed = await signInWithGoogle();
      if (signed) setUser(signed);
    } catch (e) {
      // Show the error code too, so a setup problem (for example DEVELOPER_ERROR when the
      // app's signing key is not registered in Firebase) can be told apart from a network one.
      const err = e as { code?: string | number; message?: string };
      const detail = err?.code ?? err?.message ?? String(e);
      setSettingsError(`ログインできませんでした（${detail}）。もう一度お試しください。`);
    }
  }

  async function logout() {
    await signOut();
    setEntries([]);
    setUser(null);
    // The account's goals leave with the account; the phone's own goals come back.
    await showLocalGoals();
  }

  // Adds a weight at the given time. Returns true when saved.
  async function addWeight(kg: number, at: Date): Promise<boolean> {
    setWeightError(null);
    try {
      if (user) {
        await saveWeight(user.uid, kg, at);
        setEntries(await loadWeights(user.uid));
      } else {
        const next = byNewest([{ id: String(Date.now()), kg, recordedAt: at }, ...entries]);
        setEntries(next);
        await saveLocalWeights(next);
      }
      return true;
    } catch {
      setWeightError('保存できませんでした。もう一度お試しください。');
      return false;
    }
  }

  // Changes a saved weight or its time. Returns true when saved.
  async function editWeight(id: string, kg: number, at: Date): Promise<boolean> {
    setWeightError(null);
    try {
      const next = byNewest(entries.map((e) => (e.id === id ? { ...e, kg, recordedAt: at } : e)));
      if (user) await updateWeight(user.uid, id, kg, at);
      else await saveLocalWeights(next);
      setEntries(next);
      return true;
    } catch {
      setWeightError('修正できませんでした。もう一度お試しください。');
      return false;
    }
  }

  async function removeWeight(id: string) {
    setWeightError(null);
    try {
      const next = entries.filter((e) => e.id !== id);
      if (user) await deleteWeight(user.uid, id);
      else await saveLocalWeights(next);
      setEntries(next);
    } catch {
      setWeightError('削除できませんでした。もう一度お試しください。');
    }
  }

  // Called only when the user taps an app by hand. Remembers that choice when signed in.
  function selectSource(origin: string) {
    if (user) {
      saveGoals(user.uid, { stepSource: origin }).catch(() =>
        setSettingsError('歩数のデータ元を保存できませんでした。'),
      );
    }
    syncFromHealthConnect(origin);
  }

  // Reads last night's sleep and the last 7 nights. Shown separately, so a sleep problem
  // never hides the steps.
  async function syncSleep() {
    const [r, history] = await Promise.all([readLastNightSleep(), readSleepHistory(7)]);
    setNights(history.ok ? history.nights : []);
    if (r.ok) {
      setSleep(r.night);
      setSleepMessage(r.night ? null : '昨夜の睡眠記録はありません。');
      return;
    }
    setSleep(null);
    setSleepMessage(
      r.reason === 'denied'
        ? '睡眠の読み取りが許可されていません。設定タブの「Health Connectを許可して再取得」から許可できます。'
        : '睡眠を取得できませんでした。',
    );
  }

  // Saves a sleep time picked by the user to Health Connect, then shows it on the card.
  // Returns an error message to show in the form, or null when saved.
  async function saveManualSleep(bed: Clock, wake: Clock): Promise<string | null> {
    const { start, end } = nightFrom(bed, wake);
    const error = await writeSleep(start, end);
    if (error) return error;
    await syncSleep();
    return null;
  }

  // Sends one test notification about a minute from now. Only offered in development builds.
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
  // The booking itself is done by the effect below.
  async function changeReminder(r: Reminder) {
    setReminderNote(null);
    try {
      if (r.enabled && !(await ensureNotificationPermission())) {
        setReminderNote('通知が許可されていないため、リマインダーを設定できません。');
        return;
      }
      setReminder(r);
      await storeReminder(r);
    } catch {
      setReminderNote('リマインダーを設定できませんでした。');
    }
  }

  // Books the reminders again when the setting changes, when a weight is recorded (so
  // today's reminder is skipped), and on start (so the next 30 days stay booked).
  const lastRecordedTime = latestEntry?.recordedAt.getTime() ?? null;
  useEffect(() => {
    if (!reminderLoaded.current) return;
    scheduleReminders(reminder, lastRecordedTime === null ? null : new Date(lastRecordedTime));
  }, [reminder, lastRecordedTime]);

  // Reads steps first and sleep after, one at a time.
  async function syncFromHealthConnect(preferred: string | null = stepSource) {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await readHealthConnect(preferred);
    } finally {
      syncing.current = false;
    }
  }

  async function readHealthConnect(preferred: string | null) {
    setSyncMessage('Health Connectから取得しています…');
    const result = await readRecentSteps(7, preferred);
    setStepsStatus(
      result.ok
        ? 'ok'
        : result.reason === 'denied'
          ? 'denied'
          : result.reason === 'unsupported' || result.reason === 'unavailable'
            ? 'unsupported'
            : 'error',
    );
    if (result.ok) {
      setDaily(result.daily);
      setActivity(result.today);
      setSources(result.sources);
      setStepSource(result.chosen);
      setSteps(result.daily[result.daily.length - 1]?.steps ?? 0);
      setSyncMessage(result.activityDetail ? `距離・カロリー ${result.activityDetail}` : null);
    } else {
      const text =
        result.reason === 'denied'
          ? '歩数の読み取りが許可されていません。'
          : result.reason === 'unsupported'
            ? 'このデバイスでは使えません。'
            : 'Health Connectから取得できませんでした。';
      setSyncMessage(result.detail ? `${text}（${result.detail}）` : text);
    }
    await syncSleep();
  }

  // Asks for every Health Connect permission in one screen, then reads the data.
  async function allowAndSync() {
    const r = await requestHealthPermissions();
    if (!r.ok && r.reason !== 'unsupported') {
      setSyncMessage('Health Connectを開けませんでした。Health Connectアプリが入っているか確認してください。');
    }
    await syncFromHealthConnect();
  }

  async function finishOnboarding(allow: boolean) {
    await saveOnboarded();
    setOnboarded(true);
    if (allow) await allowAndSync();
    else await syncFromHealthConnect();
  }

  useEffect(() => {
    loadReminder().then((r) => {
      reminderLoaded.current = true;
      // A new object, so the booking effect runs even when the saved setting is the default.
      setReminder({ ...r });
    });
    showLocalGoals();
    loadOnboarded().then((done) => {
      setOnboarded(done);
      // Only read what is already allowed. The first-run screen asks for permission.
      if (done) syncFromHealthConnect();
    });
    // Run once on start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The latest version of the read, for the listener below, which is set up only once.
  const syncRef = useRef(syncFromHealthConnect);
  syncRef.current = syncFromHealthConnect;
  const onboardedRef = useRef(onboarded);
  onboardedRef.current = onboarded;

  // Reads steps and sleep again whenever the app comes back to the front, so the numbers
  // are not left from the morning when the app was kept open in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && onboardedRef.current) syncRef.current();
    });
    return () => sub.remove();
  }, []);

  // Pull down on any tab to read Health Connect again.
  async function refresh() {
    setRefreshing(true);
    await syncFromHealthConnect();
    setRefreshing(false);
  }

  if (onboarded === null) {
    return <View style={styles.container} />;
  }

  if (!onboarded) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.body}>
          <OnboardingScreen onAllow={() => finishOnboarding(true)} onSkip={() => finishOnboarding(false)} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="auto" />
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[palette.accent]}
            tintColor={palette.accent}
            progressBackgroundColor={palette.surface}
          />
        }
      >
        {tab === 'today' ? (
          <TodayScreen
            entries={entries}
            latest={latestEntry}
            goalKg={goalKg}
            onAddWeight={addWeight}
            weightError={weightError}
            steps={steps}
            stepGoal={stepGoal}
            stepsStatus={stepsStatus}
            onAllowHealth={allowAndSync}
            activity={activity}
            sleep={sleep}
            sleepMessage={sleepMessage}
            onSaveSleep={saveManualSleep}
          />
        ) : tab === 'records' ? (
          <RecordsScreen
            entries={entries}
            goalKg={goalKg}
            onUpdateWeight={editWeight}
            onRemoveWeight={removeWeight}
            weightError={weightError}
            nights={nights}
            sleepMessage={sleepMessage}
            daily={daily}
            stepGoal={stepGoal}
            sleepGoal={sleepGoal}
          />
        ) : tab === 'goal' ? (
          <GoalScreen
            goalKg={goalKg}
            entries={entries}
            onSetGoal={changeGoalKg}
            stepGoal={stepGoal}
            onSetStepGoal={changeStepGoal}
            sleepGoal={sleepGoal}
            onSetSleepGoal={changeSleepGoal}
            error={goalError}
          />
        ) : (
          <SettingsScreen
            signedIn={user !== null}
            onLogin={login}
            onLogout={logout}
            reminder={reminder}
            reminderNote={reminderNote}
            onSetReminder={changeReminder}
            onTestReminder={testReminder}
            sources={sources}
            chosen={stepSource}
            onSelectSource={selectSource}
            syncMessage={syncMessage}
            onResync={allowAndSync}
            error={settingsError}
          />
        )}
      </ScrollView>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          const color = on ? palette.accent : palette.tabInactive;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setTab(key);
                scrollRef.current?.scrollTo({ y: 0, animated: false });
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              style={styles.tab}
            >
              <Icon color={color} />
              <Text style={[styles.tabText, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: p.bg },
    flex: { flex: 1 },
    body: { flex: 1, paddingTop: 56, paddingHorizontal: 20 },
    // Padding sits on the content, not the scroll view, so the last card can scroll fully into view.
    scroll: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 48 },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: p.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.line,
      paddingTop: 8,
      // Room for the phone's own navigation bar under the app.
      paddingBottom: 28,
    },
    tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
    tabText: { fontSize: 13, fontWeight: '800' },
  });
