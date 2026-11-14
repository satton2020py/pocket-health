import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Palette, useStyles } from './theme';

export type Clock = { h: number; m: number };

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const clockText = (c: Clock) => `${c.h}:${pad2(c.m)}`;
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// "11/13(金)" style date label.
export function dayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})`;
}

// One value with a minus and a plus button on each side.
function Stepper({
  label,
  value,
  onDec,
  onInc,
  incDisabled,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  incDisabled?: boolean;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDec}
        accessibilityRole="button"
        accessibilityLabel={`${label}を戻す`}
        hitSlop={6}
        style={styles.arrow}
      >
        <Text style={styles.arrowText}>−</Text>
      </Pressable>
      <Text style={styles.value} accessibilityLabel={`${label} ${value}`}>
        {value}
      </Text>
      <Pressable
        onPress={onInc}
        disabled={incDisabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}を進める`}
        hitSlop={6}
        style={[styles.arrow, incDisabled && { opacity: 0.3 }]}
      >
        <Text style={styles.arrowText}>＋</Text>
      </Pressable>
    </View>
  );
}

// Picks an hour and a minute. Minutes move in `minuteStep` steps and wrap around.
export function TimePicker({
  value,
  onChange,
  minuteStep = 5,
}: {
  value: Clock;
  onChange: (c: Clock) => void;
  minuteStep?: number;
}) {
  const styles = useStyles(makeStyles);
  const hour = (d: number) => onChange({ ...value, h: (value.h + d + 24) % 24 });
  const minute = (d: number) => {
    const m = (Math.round(value.m / minuteStep) * minuteStep + d * minuteStep + 60) % 60;
    onChange({ ...value, m });
  };
  return (
    <View style={styles.row}>
      <Stepper label="時" value={`${value.h}時`} onDec={() => hour(-1)} onInc={() => hour(1)} />
      <Stepper label="分" value={`${pad2(value.m)}分`} onDec={() => minute(-1)} onInc={() => minute(1)} />
    </View>
  );
}

// Picks a day (not in the future) and a time of day.
export function DateTimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const styles = useStyles(makeStyles);
  const now = new Date();
  const isToday = value.toDateString() === now.toDateString();

  function shiftDay(days: number) {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    onChange(next > now ? now : next);
  }
  function setClock(c: Clock) {
    const next = new Date(value);
    next.setHours(c.h, c.m, 0, 0);
    onChange(next > now ? now : next);
  }

  return (
    <View style={styles.column}>
      <Stepper
        label="日付"
        value={isToday ? `今日 ${dayLabel(value)}` : dayLabel(value)}
        onDec={() => shiftDay(-1)}
        onInc={() => shiftDay(1)}
        incDisabled={isToday}
      />
      <TimePicker
        value={{ h: value.getHours(), m: value.getMinutes() }}
        onChange={setClock}
        minuteStep={5}
      />
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 8 },
    column: { gap: 8 },
    stepper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: p.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.line,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    arrow: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surface,
    },
    arrowText: { color: p.accent, fontSize: 20, fontWeight: '800' },
    value: {
      flex: 1,
      textAlign: 'center',
      color: p.fg,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
  });
