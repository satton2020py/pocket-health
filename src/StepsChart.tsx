import { StyleSheet, Text, View } from 'react-native';
import { type Palette, useStyles } from './theme';
import type { DailySteps } from './healthConnect';
import { WeekBarChart } from './WeekBarChart';

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

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>過去7日間の歩数</Text>
      <Text style={styles.sub}>
        平均 {average.toLocaleString('ja-JP')}歩 ／ 目標達成 {reachedDays}/{daily.length}日
      </Text>
      <WeekBarChart
        bars={daily.map((d) => ({
          date: d.date,
          value: d.steps,
          label: d.steps.toLocaleString('ja-JP'),
          reached: d.steps >= stepGoal,
        }))}
        target={stepGoal}
        targetLabel={`目標 ${stepGoal.toLocaleString('ja-JP')}歩`}
        maxValue={chartMax}
      />
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: p.fg },
    sub: { fontSize: 13, color: p.muted },
  });
