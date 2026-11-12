import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { palette } from './theme';
import type { DailySteps } from './healthConnect';

export const DEFAULT_STEP_GOAL = 8000;

type Props = {
  steps: number;
  stepGoal: number;
  daily: DailySteps[];
  activity: { distanceKm: number; kcal: number };
};

const BAR_BELOW = '#7FB89A';
const BAR_REACHED = palette.accent;
const CHART_H = 140;
const BAR_W = 22;

// Shows today's steps as a ring, and the last 7 days as bars against the goal.
export function TodayScreen({ steps, stepGoal, daily, activity }: Props) {
  // The ring stops at a full circle, but the percentage keeps counting past 100%.
  const ratio = Math.min(steps / stepGoal, 1);
  const percent = Math.round((steps / stepGoal) * 100);
  const size = 200;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Average over the days that have any steps, so an unsynced day does not pull it down.
  const withData = daily.filter((d) => d.steps > 0);
  const average =
    withData.length > 0
      ? Math.round(withData.reduce((s, d) => s + d.steps, 0) / withData.length)
      : 0;
  const reachedDays = daily.filter((d) => d.steps >= stepGoal).length;

  const chartMax = Math.max(stepGoal, ...daily.map((d) => d.steps)) * 1.1;
  const barY = (v: number) => CHART_H - (v / chartMax) * CHART_H;
  const chartW = 320;
  const slot = chartW / Math.max(daily.length, 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>今日</Text>

      <View style={styles.ringBox}>
        <Svg width={size} height={size} style={styles.svg}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={palette.line}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={palette.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={styles.steps}>{steps.toLocaleString('ja-JP')}</Text>
          <Text style={styles.sub}>
            歩 ／ 目標 {stepGoal.toLocaleString('ja-JP')}歩
          </Text>
        </View>
      </View>

      <Text style={styles.percent}>目標の {percent}%</Text>

      <Text style={styles.activity}>
        {activity.distanceKm.toFixed(2)} km ｜ {Math.round(activity.kcal).toLocaleString('ja-JP')} kcal
      </Text>

      {daily.length > 0 ? (
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
              stroke={palette.accent}
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <SvgText
              x={chartW}
              y={barY(stepGoal) - 6}
              fontSize={11}
              fill={palette.accent}
              textAnchor="end"
            >
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
                    fill={reached ? BAR_REACHED : BAR_BELOW}
                  />
                  <SvgText
                    x={cx}
                    y={Math.max(CHART_H - h, 12) - 6}
                    fontSize={12}
                    fontWeight="700"
                    fill={palette.fg}
                    textAnchor="middle"
                  >
                    {d.steps.toLocaleString('ja-JP')}
                  </SvgText>
                  <SvgText
                    x={cx}
                    y={CHART_H + 18}
                    fontSize={12}
                    fontWeight={isToday ? '800' : '400'}
                    fill={isToday ? palette.fg : palette.muted}
                    textAnchor="middle"
                  >
                    {d.date.getDate()}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    alignSelf: 'stretch',
    fontSize: 22,
    fontWeight: '800',
    color: palette.fg,
  },
  ringBox: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    alignItems: 'center',
  },
  steps: {
    fontSize: 36,
    fontWeight: '800',
    color: palette.fg,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 4,
  },
  percent: {
    fontSize: 15,
    color: palette.fg,
    fontWeight: '700',
  },
  activity: {
    fontSize: 14,
    color: palette.muted,
    fontVariant: ['tabular-nums'],
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.fg,
  },
});
