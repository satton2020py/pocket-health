import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { type Palette, useStyles } from './theme';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';
import { WeightChart } from './WeightChart';
import { WeightInput } from './WeightInput';
import { DateTimePicker, dayLabel } from './pickers';
import type { SleepNight } from './sleep';
import type { DailySteps } from './healthConnect';
import { StepsChart } from './StepsChart';
import { WeekBarChart } from './WeekBarChart';
import { bedtimeSpread, clockFromEvening } from './insights';

type Props = {
  entries: WeightEntry[];
  goalKg: number | null;
  onUpdateWeight: (id: string, kg: number, at: Date) => Promise<boolean>;
  onRemoveWeight: (id: string) => Promise<void>;
  weightError: string | null;
  nights: SleepNight[];
  sleepMessage: string | null;
  daily: DailySteps[];
  stepGoal: number;
  // Hours of sleep to aim for, set on the Goal tab.
  sleepGoal: number;
};

const timeOf = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

// Opens under a tapped record to change its weight or time, or to delete it.
function WeightEditor({
  entry,
  onSave,
  onRemove,
  onClose,
}: {
  entry: WeightEntry;
  onSave: Props['onUpdateWeight'];
  onRemove: Props['onRemoveWeight'];
  onClose: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [text, setText] = useState(formatWeight(entry.kg));
  const [at, setAt] = useState(entry.recordedAt);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const kg = parseWeightInput(text);
    if (kg === null) {
      setError('20〜300kgの数字を入力してください（小数点2位まで）。');
      return;
    }
    if (await onSave(entry.id, kg, at)) onClose();
  }

  // Asks first, because a delete cannot be undone.
  function confirmRemove() {
    Alert.alert('この記録を削除しますか？', '削除すると元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onRemove(entry.id) },
    ]);
  }

  return (
    <View style={styles.editor}>
      <WeightInput
        text={text}
        onChange={(t) => {
          setText(t);
          setError(null);
        }}
        fallbackKg={entry.kg}
      />
      <DateTimePicker value={at} onChange={setAt} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.btnRow}>
        <Pressable onPress={confirmRemove} accessibilityRole="button" style={styles.ghostBtn}>
          <Text style={styles.dangerText}>削除</Text>
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.ghostBtn}>
          <Text style={styles.ghostText}>閉じる</Text>
        </Pressable>
        <Pressable onPress={save} accessibilityRole="button" style={styles.smallCta}>
          <Text style={styles.ctaText}>保存</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WeightRecords(props: Props) {
  const styles = useStyles(makeStyles);
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = [...props.entries].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

  return (
    <>
      <WeightChart entries={props.entries} goalKg={props.goalKg} />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>記録一覧</Text>
        <Text style={styles.sub}>記録をタップすると、体重や日時を直せます。</Text>
        {props.weightError ? <Text style={styles.error}>{props.weightError}</Text> : null}
        {sorted.length === 0 ? <Text style={styles.sub}>まだ記録がありません。</Text> : null}
        {sorted.map((e, i) => {
          const prev = sorted[i + 1];
          const diff = prev ? e.kg - prev.kg : null;
          // A month heading above the first (newest) record of each month.
          const newer = sorted[i - 1];
          const monthStarts =
            !newer ||
            newer.recordedAt.getMonth() !== e.recordedAt.getMonth() ||
            newer.recordedAt.getFullYear() !== e.recordedAt.getFullYear();
          return (
            <View key={e.id}>
              {monthStarts ? (
                <Text style={styles.month}>
                  {e.recordedAt.getFullYear()}年{e.recordedAt.getMonth() + 1}月
                </Text>
              ) : null}
              <Pressable
                onPress={() => setEditing(editing === e.id ? null : e.id)}
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel(e.recordedAt)} ${formatWeight(e.kg)}kg を編集`}
                style={styles.row}
              >
                <Text style={styles.rowDate}>
                  {dayLabel(e.recordedAt)} {timeOf(e.recordedAt)}
                </Text>
                <View style={styles.rowRight}>
                  {diff !== null ? (
                    <Text style={[styles.diff, diff < 0 && styles.diffDown]}>
                      {diff > 0 ? '+' : ''}
                      {formatWeight(diff)}
                    </Text>
                  ) : null}
                  <Text style={styles.rowValue}>{formatWeight(e.kg)} kg</Text>
                </View>
              </Pressable>
              {editing === e.id ? (
                <WeightEditor
                  entry={e}
                  onSave={props.onUpdateWeight}
                  onRemove={async (id) => {
                    await props.onRemoveWeight(id);
                    setEditing(null);
                  }}
                  onClose={() => setEditing(null)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </>
  );
}

function SleepRecords({
  nights,
  sleepMessage,
  sleepGoal: SLEEP_TARGET_HOURS,
}: Pick<Props, 'nights' | 'sleepMessage' | 'sleepGoal'>) {
  const styles = useStyles(makeStyles);

  if (nights.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sub}>
          {sleepMessage ?? '睡眠の記録を読み込めていません。設定タブからHealth Connectを許可してください。'}
        </Text>
      </View>
    );
  }

  const withData = nights.filter((n) => n.hours > 0);
  const average =
    withData.length > 0 ? withData.reduce((s, n) => s + n.hours, 0) / withData.length : 0;
  const reached = nights.filter((n) => n.hours >= SLEEP_TARGET_HOURS).length;
  const spread = bedtimeSpread(nights);
  const chartMax = Math.max(SLEEP_TARGET_HOURS + 1, ...nights.map((n) => n.hours)) * 1.1;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>過去7日間の睡眠</Text>
        <Text style={styles.sub}>
          平均 {average.toFixed(1)}時間 ／ {SLEEP_TARGET_HOURS}時間以上 {reached}/{nights.length}日
        </Text>
        <WeekBarChart
          bars={nights.map((n) => ({
            date: n.date,
            value: n.hours,
            label: n.hours > 0 ? n.hours.toFixed(1) : null,
            reached: n.hours >= SLEEP_TARGET_HOURS,
          }))}
          target={SLEEP_TARGET_HOURS}
          targetLabel={`目安 ${SLEEP_TARGET_HOURS}時間`}
          maxValue={chartMax}
        />
      </View>

      {spread ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>就寝時刻のばらつき</Text>
          <Text style={styles.sub}>
            平均 {clockFromEvening(spread.averageMin)} ごろ ／ ばらつき 約±{spread.spreadMin}分（{spread.count}日分）
          </Text>
          <Text style={styles.sub}>
            {spread.spreadMin <= 30
              ? '寝る時間がよくそろっています。'
              : spread.spreadMin <= 60
                ? '寝る時間が日によって少し動いています。'
                : '寝る時間が日によって1時間以上動いています。そろえると眠りの質が上がりやすくなります。'}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>睡眠の記録</Text>
        {[...nights].reverse().map((n) => (
          <View key={n.date.toISOString()} style={styles.row}>
            <Text style={styles.rowDate}>{dayLabel(n.date)} の朝</Text>
            <Text style={styles.rowValue}>
              {n.start && n.end ? `${timeOf(n.start)}〜${timeOf(n.end)}　${n.hours.toFixed(1)}時間` : '記録なし'}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

// The 7-day steps chart, then one row per day with the newest first.
function StepsRecords({ daily, stepGoal }: Pick<Props, 'daily' | 'stepGoal'>) {
  const styles = useStyles(makeStyles);
  return (
    <>
      <StepsChart
        daily={daily}
        stepGoal={stepGoal}
        emptyMessage="歩数を読み込めていません。今日タブからHealth Connectを許可してください。"
      />
      {daily.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>歩数の記録</Text>
          {[...daily].reverse().map((d) => (
            <View key={d.date.toISOString()} style={styles.row}>
              <Text style={styles.rowDate}>{dayLabel(d.date)}</Text>
              <View style={styles.rowRight}>
                {d.steps >= stepGoal ? <Text style={styles.reached}>目標達成</Text> : null}
                <Text style={styles.rowValue}>{d.steps.toLocaleString('ja-JP')}歩</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

// History and charts for weight, sleep and steps, switched with buttons at the top.
export function RecordsScreen(props: Props) {
  const styles = useStyles(makeStyles);
  const [kind, setKind] = useState<'weight' | 'sleep' | 'steps'>('weight');
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>記録</Text>
      <View style={styles.segment}>
        {(
          [
            ['weight', '体重'],
            ['sleep', '睡眠'],
            ['steps', '歩数'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === k }}
            style={[styles.segBtn, kind === k && styles.segOn]}
          >
            <Text style={[styles.segText, kind === k && styles.segTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {kind === 'weight' ? (
        <WeightRecords {...props} />
      ) : kind === 'sleep' ? (
        <SleepRecords nights={props.nights} sleepMessage={props.sleepMessage} sleepGoal={props.sleepGoal} />
      ) : (
        <StepsRecords daily={props.daily} stepGoal={props.stepGoal} />
      )}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: 16 },
    title: { fontSize: 22, fontWeight: '800', color: p.fg },
    card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: p.fg },
    sub: { fontSize: 13, color: p.muted },
    error: { color: p.error, fontSize: 13 },
    segment: { flexDirection: 'row', backgroundColor: p.line, borderRadius: 999, padding: 4 },
    segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
    segOn: { backgroundColor: p.surface },
    segText: { color: p.muted, fontWeight: '700' },
    segTextOn: { color: p.fg },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.line,
    },
    rowDate: { color: p.muted, fontSize: 14 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowValue: { color: p.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
    diff: { color: p.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
    diffDown: { color: p.accent, fontWeight: '700' },
    reached: { color: p.accent, fontSize: 12, fontWeight: '700' },
    month: { color: p.fg, fontSize: 14, fontWeight: '800', marginTop: 12 },
    editor: { gap: 8, paddingVertical: 10 },
    btnRow: { flexDirection: 'row', gap: 8 },
    smallCta: { flex: 1, backgroundColor: p.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
    ctaText: { color: p.onAccent, fontSize: 15, fontWeight: '800' },
    ghostBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: p.line },
    ghostText: { color: p.muted, fontSize: 15, fontWeight: '700' },
    dangerText: { color: p.error, fontSize: 15, fontWeight: '700' },
  });
