import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Palette, useStyles } from './theme';
import { sourceLabel } from './TodayScreen';
import type { StepSource } from './healthConnect';
import type { Reminder } from './reminder';
import { type Clock, clockText, TimePicker } from './pickers';

type Props = {
  signedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  reminder: Reminder;
  reminderNote: string | null;
  onSetReminder: (r: Reminder) => void;
  onTestReminder: () => void;
  sources: StepSource[];
  chosen: string | null;
  onSelectSource: (origin: string) => void;
  syncMessage: string | null;
  onResync: () => void;
  onExportCsv: () => void;
  onImportCsv: () => void;
  dataNote: string | null;
  // A failure from this screen (login, saving the step app), shown here.
  error: string | null;
};

// Common times, so a morning weigh-in reminder is one tap.
const PRESETS: Clock[] = [
  { h: 7, m: 0 },
  { h: 12, m: 0 },
  { h: 21, m: 0 },
];

export function SettingsScreen(props: Props) {
  const styles = useStyles(makeStyles);
  const { reminder } = props;
  const [draft, setDraft] = useState<Clock>({ h: reminder.hour, m: reminder.minute });

  // Follow the saved time once it has loaded from the phone.
  useEffect(() => {
    setDraft({ h: reminder.hour, m: reminder.minute });
  }, [reminder.hour, reminder.minute]);

  const changed = draft.h !== reminder.hour || draft.m !== reminder.minute;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>設定</Text>
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>アカウント</Text>
        <Text style={styles.sub}>
          {props.signedIn
            ? 'Googleでログイン中です。記録はあなた専用のクラウドに保存されます。'
            : 'ログインしなくても、記録はこの端末に保存されます。ログインすると機種変更後も残ります。'}
        </Text>
        <Pressable
          style={props.signedIn ? styles.ghostBtn : styles.cta}
          onPress={props.signedIn ? props.onLogout : props.onLogin}
          accessibilityRole="button"
        >
          <Text style={props.signedIn ? styles.ghostText : styles.ctaText}>
            {props.signedIn ? 'ログアウト' : 'Googleでログイン'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>毎日のリマインダー</Text>
        <Text style={styles.sub}>
          {reminder.enabled
            ? `毎日 ${clockText({ h: reminder.hour, m: reminder.minute })} に通知します。`
            : '通知はオフです。'}
        </Text>
        <View style={styles.chipRow}>
          {PRESETS.map((c) => {
            const on = draft.h === c.h && draft.m === c.m;
            return (
              <Pressable
                key={clockText(c)}
                onPress={() => setDraft(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{clockText(c)}</Text>
              </Pressable>
            );
          })}
        </View>
        <TimePicker value={draft} onChange={setDraft} />
        <View style={styles.btnRow}>
          {reminder.enabled ? (
            <Pressable
              onPress={() => props.onSetReminder({ ...reminder, enabled: false })}
              accessibilityRole="button"
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostText}>オフにする</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => props.onSetReminder({ enabled: true, hour: draft.h, minute: draft.m })}
            disabled={reminder.enabled && !changed}
            accessibilityRole="button"
            style={[styles.cta, styles.flex, reminder.enabled && !changed && { opacity: 0.4 }]}
          >
            <Text style={styles.ctaText}>
              {reminder.enabled ? 'この時刻に変える' : `${clockText(draft)} でオンにする`}
            </Text>
          </Pressable>
        </View>
        {__DEV__ ? (
          <Pressable onPress={props.onTestReminder} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.link}>1分後にテスト通知（開発用）</Text>
          </Pressable>
        ) : null}
        {props.reminderNote ? <Text style={styles.sub}>{props.reminderNote}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Connect</Text>
        <Text style={styles.sub}>
          歩数・距離・消費カロリー・睡眠・体重を読み取ります。体組成計のアプリが保存した体重は、自動で記録に取り込みます。睡眠を手で入力したときだけ書き込みます。
        </Text>
        <Pressable onPress={props.onResync} accessibilityRole="button" style={styles.cta}>
          <Text style={styles.ctaText}>Health Connectを許可して再取得</Text>
        </Pressable>
        {props.syncMessage ? <Text style={styles.sub}>{props.syncMessage}</Text> : null}

        <Text style={styles.subTitle}>歩数のデータ元</Text>
        {props.sources.length === 0 ? (
          <Text style={styles.sub}>
            Health Connectから、まだ歩数を読み取れていません。上のボタンを押してください。
          </Text>
        ) : (
          <>
            <Text style={styles.sub}>
              同じ歩数が重ならないよう、1つのアプリの数字だけを使っています。
            </Text>
            <View style={styles.chipRow}>
              {props.sources.map((s) => {
                const on = s.origin === props.chosen;
                return (
                  <Pressable
                    key={s.origin}
                    onPress={() => props.onSelectSource(s.origin)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {sourceLabel(s.origin)} {s.total.toLocaleString('ja-JP')}歩
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>体重の記録の書き出し・読み込み</Text>
        <Text style={styles.sub}>
          CSVファイル（表計算で開けます）で書き出して、Googleドライブやメールに保存できます。
          ほかのアプリから書き出したCSVも、日付と体重の列があれば読み込めます。
        </Text>
        <View style={styles.btnRow}>
          <Pressable onPress={props.onExportCsv} accessibilityRole="button" style={[styles.cta, styles.flex]}>
            <Text style={styles.ctaText}>書き出す</Text>
          </Pressable>
          <Pressable onPress={props.onImportCsv} accessibilityRole="button" style={styles.ghostBtn}>
            <Text style={styles.ghostText}>読み込む</Text>
          </Pressable>
        </View>
        {props.dataNote ? <Text style={styles.sub}>{props.dataNote}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: 16 },
    title: { fontSize: 22, fontWeight: '800', color: p.fg },
    card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, gap: 10 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: p.fg },
    subTitle: { fontSize: 14, fontWeight: '800', color: p.fg, marginTop: 6 },
    sub: { fontSize: 13, color: p.muted },
    error: { color: p.error, fontSize: 13 },
    link: { color: p.accent, fontSize: 14, fontWeight: '700' },
    flex: { flex: 1 },
    btnRow: { flexDirection: 'row', gap: 8 },
    cta: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, backgroundColor: p.accent },
    ctaText: { color: p.onAccent, fontSize: 15, fontWeight: '700' },
    ghostBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 999, backgroundColor: p.line },
    ghostText: { color: p.muted, fontSize: 15, fontWeight: '700' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: p.bg,
      borderWidth: 1,
      borderColor: p.line,
    },
    chipOn: { backgroundColor: p.accent, borderColor: p.accent },
    chipText: { color: p.muted, fontSize: 13, fontWeight: '700' },
    chipTextOn: { color: p.onAccent },
  });
