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

// Moves a clock by some minutes, carrying into the hour and wrapping past midnight.
export function shiftClock(c: Clock, minutes: number): Clock {
  const total = (((c.h * 60 + c.m + minutes) % 1440) + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

// The current time rounded to the nearest 5 minutes.
export function nowClock(now: Date = new Date()): Clock {
  return shiftClock({ h: now.getHours(), m: 0 }, Math.round(now.getMinutes() / 5) * 5);
}

// A time with quick buttons: -1 hour, -15 minutes, +15 minutes, +1 hour.
// Minutes carry into the hour, so 23:45 + 15 minutes is 0:00. `extra` adds a chip such as "今".
export function QuickTime({
  label,
  value,
  onChange,
  extra,
}: {
  label: string;
  value: Clock;
  onChange: (c: Clock) => void;
  extra?: { label: string; onPress: () => void };
}) {
  const styles = useStyles(makeStyles);
  const steps: [string, number][] = [
    ['−1時間', -60],
    ['−15分', -15],
    ['+15分', 15],
    ['+1時間', 60],
  ];
  return (
    <View style={styles.quick}>
      <View style={styles.quickHead}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text style={styles.quickTime} accessibilityLabel={`${label} ${clockText(value)}`}>
          {clockText(value)}
        </Text>
        {extra ? (
          <Pressable onPress={extra.onPress} accessibilityRole="button" hitSlop={6} style={[styles.chip, styles.chipFixed]}>
            <Text style={styles.chipText}>{extra.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.row}>
        {steps.map(([text, d]) => (
          <Pressable
            key={text}
            onPress={() => onChange(shiftClock(value, d))}
            accessibilityRole="button"
            accessibilityLabel={`${label}を${text}`}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{text}</Text>
          </Pressable>
        ))}
      </View>
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
    quick: { gap: 8 },
    quickHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    quickLabel: { color: p.muted, fontSize: 14, fontWeight: '700', width: 36 },
    quickTime: {
      flex: 1,
      color: p.fg,
      fontSize: 26,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    chip: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.bg,
      borderWidth: 1,
      borderColor: p.line,
    },
    chipFixed: { flex: 0, paddingHorizontal: 16 },
    chipText: { color: p.accent, fontSize: 14, fontWeight: '700' },
    value: {
      flex: 1,
      textAlign: 'center',
      color: p.fg,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
  });
