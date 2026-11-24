import { useWindowDimensions, View, Text, StyleSheet } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { type Palette, usePalette, useStyles } from './theme';

// Height of the bars' area. Taller than before so the card fills more of the screen.
const PLOT_H = 200;
// Room above the tallest bar for its value label, so the label is never cut off.
const TOP_PAD = 22;
// Room below the bars for the day numbers.
const BOTTOM_PAD = 26;
const BAR_W = 22;

export type WeekBar = {
  date: Date;
  value: number;
  // Text over the bar; null shows nothing.
  label: string | null;
  reached: boolean;
};

// Seven daily bars with a dashed target line. The target's label sits under the chart as a
// legend, not inside the chart, so it never overlaps a bar or runs off the right edge.
export function WeekBarChart({
  bars,
  target,
  targetLabel,
  maxValue,
}: {
  bars: WeekBar[];
  target: number;
  targetLabel: string;
  // The value at the top of the plot area.
  maxValue: number;
}) {
  const styles = useStyles(makeStyles);
  const p = usePalette();
  const { width: windowWidth } = useWindowDimensions();

  // Screen padding (20 each side) and card padding (16 each side).
  const chartW = Math.max(240, windowWidth - 72);
  const slot = chartW / bars.length;
  const baseY = TOP_PAD + PLOT_H;
  const barH = (v: number) => (v / maxValue) * PLOT_H;
  const targetY = baseY - barH(target);

  return (
    <View style={styles.wrap}>
      <Svg width={chartW} height={baseY + BOTTOM_PAD}>
        <Line
          x1={0}
          x2={chartW}
          y1={targetY}
          y2={targetY}
          stroke={p.accent}
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
        {bars.map((b, i) => {
          const h = barH(b.value);
          const cx = i * slot + slot / 2;
          const isToday = i === bars.length - 1;
          return (
            <G key={i}>
              <Rect
                x={cx - BAR_W / 2}
                y={baseY - h}
                width={BAR_W}
                height={Math.max(h, 2)}
                rx={BAR_W / 2}
                fill={b.reached ? p.accent : p.accentSoft}
              />
              {b.label !== null ? (
                <SvgText
                  x={cx}
                  y={baseY - h - 6}
                  fontSize={11}
                  fontWeight="700"
                  fill={p.fg}
                  textAnchor="middle"
                >
                  {b.label}
                </SvgText>
              ) : null}
              <SvgText
                x={cx}
                y={baseY + 18}
                fontSize={12}
                fontWeight={isToday ? '800' : '400'}
                fill={isToday ? p.fg : p.muted}
                textAnchor="middle"
              >
                {b.date.getDate()}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <Svg width={18} height={4}>
          <Line x1={0} x2={18} y1={2} y2={2} stroke={p.accent} strokeWidth={1.5} strokeDasharray="3 4" />
        </Svg>
        <Text style={styles.legendText}>{targetLabel}</Text>
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: 4 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontSize: 12, color: p.accent },
  });
