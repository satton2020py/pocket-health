import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { type Palette, usePalette, useStyles } from './theme';
import { formatWeight, parseWeightInput, type WeightEntry } from './weight';
import { WeightChart } from './WeightChart';
import { WeightInput } from './WeightInput';
import { DateTimePicker, dayLabel } from './pickers';
import type { SleepNight } from './sleep';
import type { DailySteps } from './healthConnect';
import { StepsChart } from './StepsChart';

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

const CHART_H = 140;
const BAR_W = 22;

function SleepRecords({
  nights,
  sleepMessage,
  sleepGoal: SLEEP_TARGET_HOURS,
}: Pick<Props, 'nights' | 'sleepMessage' | 'sleepGoal'>) {
  const styles = useStyles(makeStyles);
  const p = usePalette();
  const { width: windowWidth } = useWindowDimensions();

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
  const chartW = Math.max(240, windowWidth - 72);
  const chartMax = Math.max(SLEEP_TARGET_HOURS + 1, ...nights.map((n) => n.hours)) * 1.1;
  const barY = (h: number) => CHART_H - (h / chartMax) * CHART_H;
  const slot = chartW / nights.length;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>過去7日間の睡眠</Text>
        <Text style={styles.sub}>
          平均 {average.toFixed(1)}時間 ／ {SLEEP_TARGET_HOURS}時間以上 {reached}/{nights.length}日
        </Text>
        <Svg width={chartW} height={CHART_H + 26}>
          <Line
            x1={0}
            x2={chartW}
            y1={barY(SLEEP_TARGET_HOURS)}
            y2={barY(SLEEP_TARGET_HOURS)}
            stroke={p.accent}
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
          <SvgText x={chartW} y={barY(SLEEP_TARGET_HOURS) - 6} fontSize={11} fill={p.accent} textAnchor="end">
            目安 {SLEEP_TARGET_HOURS}時間
          </SvgText>
          {nights.map((n, i) => {
            const h = (n.hours / chartMax) * CHART_H;
            const cx = i * slot + slot / 2;
            const isToday = i === nights.length - 1;
            return (
              <G key={i}>
                <Rect
                  x={cx - BAR_W / 2}
                  y={CHART_H - h}
                  width={BAR_W}
                  height={Math.max(h, 2)}
                  rx={BAR_W / 2}
                  fill={n.hours >= SLEEP_TARGET_HOURS ? p.accent : p.accentSoft}
                />
                {n.hours > 0 ? (
                  <SvgText
                    x={cx}
                    y={Math.max(CHART_H - h, 12) - 6}
                    fontSize={11}
                    fontWeight="700"
                    fill={p.fg}
                    textAnchor="middle"
                  >
                    {n.hours.toFixed(1)}
                  </SvgText>
                ) : null}
                <SvgText
                  x={cx}
                  y={CHART_H + 18}
                  fontSize={12}
                  fontWeight={isToday ? '800' : '400'}
                  fill={isToday ? p.fg : p.muted}
                  textAnchor="middle"
                >
                  {n.date.getDate()}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

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
        <StepsChart
          daily={props.daily}
          stepGoal={props.stepGoal}
          emptyMessage="歩数を読み込めていません。今日タブからHealth Connectを許可してください。"
        />
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
    month: { color: p.fg, fontSize: 14, fontWeight: '800', marginTop: 12 },
    editor: { gap: 8, paddingVertical: 10 },
    btnRow: { flexDirection: 'row', gap: 8 },
    smallCta: { flex: 1, backgroundColor: p.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
    ctaText: { color: p.onAccent, fontSize: 15, fontWeight: '800' },
    ghostBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: p.line },
    ghostText: { color: p.muted, fontSize: 15, fontWeight: '700' },
    dangerText: { color: p.error, fontSize: 15, fontWeight: '700' },
  });
