import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { type Palette, usePalette, useStyles } from './theme';
import type { DailySteps } from './healthConnect';

const CHART_H = 140;
const BAR_W = 22;

// The last 7 days of steps as bars, with the daily goal as a dashed line.
export function StepsChart({
  daily,
  stepGoal,
  emptyMessage,
}: {
  daily: DailySteps[];
  stepGoal: number;
  emptyMessage: string;
}) {
  const styles = useStyles(makeStyles);
  const p = usePalette();
  const { width: windowWidth } = useWindowDimensions();

  if (daily.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sub}>{emptyMessage}</Text>
      </View>
    );
  }

  // Average over the days that have any steps, so an unsynced day does not pull it down.
  const withData = daily.filter((d) => d.steps > 0);
  const average =
    withData.length > 0
      ? Math.round(withData.reduce((s, d) => s + d.steps, 0) / withData.length)
      : 0;
  const reachedDays = daily.filter((d) => d.steps >= stepGoal).length;

  const chartMax = Math.max(stepGoal, ...daily.map((d) => d.steps)) * 1.1;
  const barY = (v: number) => CHART_H - (v / chartMax) * CHART_H;
  // Screen padding (20 each side) and card padding (16 each side).
  const chartW = Math.max(240, windowWidth - 72);
  const slot = chartW / daily.length;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>過去7日間の歩数</Text>
      <Text style={styles.sub}>
        平均 {average.toLocaleString('ja-JP')}歩 ／ 目標達成 {reachedDays}/{daily.length}日
      </Text>
      <Svg width={chartW} height={CHART_H + 26}>
        <Line
          x1={0}
          x2={chartW}
          y1={barY(stepGoal)}
          y2={barY(stepGoal)}
          stroke={p.accent}
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
        <SvgText x={chartW} y={barY(stepGoal) - 6} fontSize={11} fill={p.accent} textAnchor="end">
          目標 {stepGoal.toLocaleString('ja-JP')}
        </SvgText>
        {daily.map((d, i) => {
          const h = (d.steps / chartMax) * CHART_H;
          const cx = i * slot + slot / 2;
          const reached = d.steps >= stepGoal;
          const isToday = i === daily.length - 1;
          return (
            <G key={i}>
              <Rect
                x={cx - BAR_W / 2}
                y={CHART_H - h}
                width={BAR_W}
                height={Math.max(h, 2)}
                rx={BAR_W / 2}
                fill={reached ? p.accent : p.accentSoft}
              />
              <SvgText
                x={cx}
                y={Math.max(CHART_H - h, 12) - 6}
                fontSize={11}
                fontWeight="700"
                fill={p.fg}
                textAnchor="middle"
              >
                {d.steps.toLocaleString('ja-JP')}
              </SvgText>
              <SvgText
                x={cx}
                y={CHART_H + 18}
                fontSize={12}
                fontWeight={isToday ? '800' : '400'}
                fill={isToday ? p.fg : p.muted}
                textAnchor="middle"
              >
                {d.date.getDate()}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: p.fg },
    sub: { fontSize: 13, color: p.muted },
  });
