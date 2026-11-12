import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { palette } from './theme';
import { formatWeight, type WeightEntry } from './weight';

type Props = {
  entries: WeightEntry[];
  goalKg: number | null;
};

const WIDTH = 340;
const HEIGHT = 220;
const PAD = 16;

// Draws the weight history as a line, oldest on the left, with the goal as a dashed line.
export function WeightChart({ entries, goalKg }: Props) {
  if (entries.length < 2) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>グラフ</Text>
        <Text style={styles.sub}>
          グラフは体重を2回以上記録すると表示されます。
        </Text>
      </View>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  const values = sorted.map((e) => e.kg);
  const allValues = goalKg !== null ? [...values, goalKg] : values;
  const min = Math.min(...allValues) - 0.5;
  const max = Math.max(...allValues) + 0.5;
  const span = max - min || 1;

  const x = (i: number) =>
    PAD + (i / (sorted.length - 1)) * (WIDTH - PAD * 2);
  const y = (kg: number) =>
    PAD + (1 - (kg - min) / span) * (HEIGHT - PAD * 2);

  const points = sorted.map((e, i) => `${x(i)},${y(e.kg)}`).join(' ');
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const change = last.kg - first.kg;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>グラフ</Text>

      <View style={styles.card}>
        <Svg width={WIDTH} height={HEIGHT}>
          {goalKg !== null ? (
            <Line
              x1={PAD}
              x2={WIDTH - PAD}
              y1={y(goalKg)}
              y2={y(goalKg)}
              stroke={palette.accent}
              strokeWidth={1.5}
              strokeDasharray="6 6"
            />
          ) : null}
          <Polyline
            points={points}
            fill="none"
            stroke={palette.accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {sorted.map((e, i) => (
            <Circle
              key={e.id}
              cx={x(i)}
              cy={y(e.kg)}
              r={4}
              fill={palette.accent}
            />
          ))}
        </Svg>
        <View style={styles.axis}>
          <Text style={styles.sub}>{first.recordedAt.toLocaleDateString('ja-JP')}</Text>
          <Text style={styles.sub}>{last.recordedAt.toLocaleDateString('ja-JP')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sub}>
          最初から {change > 0 ? '+' : ''}
          {formatWeight(change)} kg（{formatWeight(first.kg)} → {formatWeight(last.kg)} kg）
        </Text>
        {goalKg !== null ? (
          <Text style={styles.sub}>点線は目標体重 {formatWeight(goalKg)} kg です。</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.fg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sub: {
    color: palette.muted,
    fontSize: 13,
  },
});
