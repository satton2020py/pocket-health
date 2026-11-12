import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette } from './theme';

export const DEFAULT_STEP_GOAL = 8000;

type Props = {
  steps: number;
  stepGoal: number;
};

// Shows today's steps as a ring against the daily goal.
export function TodayScreen({ steps, stepGoal }: Props) {
  const ratio = Math.min(steps / stepGoal, 1);
  const percent = Math.round(ratio * 100);
  const size = 200;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

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
});
