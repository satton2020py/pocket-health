import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { palette } from './theme';
import { formatWeight, type WeightEntry } from './weight';

type Props = {
  entries: WeightEntry[];
  goalKg: number | null;
};

const RANGES = [
  { label: '1週間', days: 7 },
  { label: '1ヶ月', days: 31 },
  { label: '3ヶ月', days: 92 },
  { label: '半年', days: 183 },
  { label: '1年', days: 366 },
];

const HEIGHT = 280;
const LEFT = 58;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 34;
const GOAL_RED = '#D32F2F';
const GRID = '#EEEAE0';

// Picks a tick spacing that gives a readable number of y-axis labels.
function tickStep(span: number): number {
  if (span <= 1.5) return 0.25;
  if (span <= 6) return 0.5;
  return 1;
}

const shortDate = (d: Date) =>
  `${d.getMonth() + 1}/${d.getDate()}`;

// Shows the weight history over a chosen period, with gridlines and the goal as a red dashed line.
export function WeightChart({ entries, goalKg }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [rangeIndex, setRangeIndex] = useState(1);
  const range = RANGES[rangeIndex];

  const now = new Date();
  const start = new Date(now.getTime() - range.days * 24 * 60 * 60 * 1000);
  const visible = entries
    .filter((e) => e.recordedAt >= start && e.recordedAt <= now)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const tabs = (
    <View style={styles.tabs}>
      {RANGES.map((r, i) => (
        <Pressable
          key={r.label}
          onPress={() => setRangeIndex(i)}
          accessibilityRole="tab"
          style={[styles.tab, i === rangeIndex && styles.tabOn]}
        >
          <Text style={[styles.tabText, i === rangeIndex && styles.tabTextOn]}>
            {r.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (visible.length < 2) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>グラフ</Text>
        {tabs}
        <View style={styles.card}>
          <Text style={styles.sub}>
            この期間の記録が2件以上ないため、グラフを表示できません。
          </Text>
        </View>
      </View>
    );
  }

  const values = visible.map((e) => e.kg);
  const allValues = goalKg !== null ? [...values, goalKg] : values;
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const step = tickStep(rawMax - rawMin + 1);
  const tickMin = Math.floor((rawMin - 0.25) / step) * step;
  const tickMax = Math.ceil((rawMax + 0.25) / step) * step;
  const ticks: number[] = [];
  for (let t = tickMin; t <= tickMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }

  const width = windowWidth - 40;
  const plotW = width - LEFT - RIGHT;
  const plotH = HEIGHT - TOP - BOTTOM;
  const tStart = start.getTime();
  const tSpan = now.getTime() - tStart;

  const x = (d: Date) => LEFT + ((d.getTime() - tStart) / tSpan) * plotW;
  const y = (kg: number) =>
    TOP + (1 - (kg - tickMin) / (tickMax - tickMin)) * plotH;

  const points = visible.map((e) => `${x(e.recordedAt)},${y(e.kg)}`).join(' ');

  // Four evenly spaced date labels across the period.
  const dateMarks = [0, 1 / 3, 2 / 3, 1].map((f) => ({
    f,
    date: new Date(tStart + f * tSpan),
  }));

  const first = visible[0];
  const last = visible[visible.length - 1];
  const change = last.kg - first.kg;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>グラフ</Text>
      {tabs}

      <View style={styles.card}>
        <Svg width={width} height={HEIGHT}>
          {ticks.map((t) => (
            <Line
              key={`g${t}`}
              x1={LEFT}
              x2={width - RIGHT}
              y1={y(t)}
              y2={y(t)}
              stroke={GRID}
              strokeWidth={1}
            />
          ))}
          {dateMarks.map((m) => (
            <Line
              key={`v${m.f}`}
              x1={LEFT + m.f * plotW}
              x2={LEFT + m.f * plotW}
              y1={TOP}
              y2={HEIGHT - BOTTOM}
              stroke={GRID}
              strokeWidth={1}
            />
          ))}
          {ticks.map((t) => (
            <SvgText
              key={`l${t}`}
              x={LEFT - 8}
              y={y(t) + 4}
              fontSize={12}
              fill={palette.muted}
              textAnchor="end"
            >
              {t.toFixed(2)}
            </SvgText>
          ))}
          {dateMarks.map((m) => (
            <SvgText
              key={`d${m.f}`}
              x={LEFT + m.f * plotW}
              y={HEIGHT - 10}
              fontSize={11}
              fill={palette.muted}
              textAnchor={m.f === 0 ? 'start' : m.f === 1 ? 'end' : 'middle'}
            >
              {shortDate(m.date)}
            </SvgText>
          ))}
          {goalKg !== null ? (
            <>
              <Line
                x1={LEFT}
                x2={width - RIGHT}
                y1={y(goalKg)}
                y2={y(goalKg)}
                stroke={GOAL_RED}
                strokeWidth={2}
                strokeDasharray="6 5"
              />
              <Rect
                x={0}
                y={y(goalKg) - 10}
                width={LEFT - 6}
                height={20}
                rx={4}
                fill={GOAL_RED}
              />
              <SvgText
                x={(LEFT - 6) / 2}
                y={y(goalKg) + 4}
                fontSize={12}
                fontWeight="700"
                fill="#FFFFFF"
                textAnchor="middle"
              >
                {goalKg.toFixed(2)}
              </SvgText>
            </>
          ) : null}
          <Polyline
            points={points}
            fill="none"
            stroke={palette.accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {visible.map((e) => (
            <Circle
              key={e.id}
              cx={x(e.recordedAt)}
              cy={y(e.kg)}
              r={4.5}
              fill={palette.accent}
            />
          ))}
        </Svg>
      </View>

      <View style={styles.card}>
        <Text style={styles.sub}>
          この期間の変化 {change > 0 ? '+' : ''}
          {formatWeight(change)} kg（{formatWeight(first.kg)} → {formatWeight(last.kg)} kg）
        </Text>
        {goalKg !== null ? (
          <Text style={styles.sub}>赤い点線は目標体重 {formatWeight(goalKg)} kg です。</Text>
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
    padding: 8,
    gap: 8,
  },
  sub: {
    color: palette.muted,
    fontSize: 13,
    padding: 4,
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
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextOn: {
    color: palette.fg,
  },
});
