import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { type Palette, usePalette, useStyles } from './theme';
import {
  celebrationEvents,
  type CelebrationEvent,
  type DayResult,
  MEDAL_LABEL,
  type Medal,
  pruneSeen,
  STREAK_BADGES,
  type StreakSummary,
  WEIGHT_STEP_KG,
} from './achievements';

// Medal colors. They stay the same in dark mode so gold always reads as gold.
const MEDAL_COLOR: Record<Exclude<Medal, null>, string> = {
  gold: '#D4A93C',
  silver: '#A3ABB0',
  bronze: '#B87A4B',
};

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

function MedalDot({ medal, size }: { medal: Medal; size: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View
      style={[
        styles.medal,
        { width: size, height: size, borderRadius: size / 2 },
        medal ? { backgroundColor: MEDAL_COLOR[medal] } : styles.medalNone,
      ]}
    >
      <Text style={[styles.medalText, { fontSize: size * 0.42 }, !medal && styles.medalTextNone]}>
        {medal ? MEDAL_LABEL[medal] : '−'}
      </Text>
    </View>
  );
}

export type TodayAchievements = {
  steps: number | null; // null when steps cannot be read
  stepGoal: number;
  stepMedal: Medal;
  sleepHours: number | null;
  sleepGoal: number;
  sleepReached: boolean;
  weekChangeKg: number | null;
  weightUnits: number;
};

// Today's results on the Today tab, one row each: steps (a medal by how far past the
// goal), last night's sleep, and this week's weight in 500 g steps. Below them, the
// last 7 days of steps medals and sleep, and the record streak.
export function MedalCard({
  today,
  week,
  streak,
}: {
  today: TodayAchievements;
  week: DayResult[];
  streak: StreakSummary;
}) {
  const styles = useStyles(makeStyles);
  const pct = today.steps !== null && today.stepGoal > 0 ? Math.round((today.steps / today.stepGoal) * 100) : null;
  const nextStep =
    pct === null ? null : pct < 80 ? '80%で銅' : pct < 100 ? '100%で銀' : pct < 120 ? '120%で金' : null;
  const lost = today.weekChangeKg !== null ? -today.weekChangeKg : null;
  const toNextKg = lost !== null ? (today.weightUnits + 1) * WEIGHT_STEP_KG - lost : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>今日の達成</Text>

      <View style={styles.row}>
        <MedalDot medal={today.stepMedal} size={40} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>歩数{today.stepMedal ? ` ${MEDAL_LABEL[today.stepMedal]}メダル` : ''}</Text>
          <Text style={styles.sub}>
            {pct === null ? '歩数が読めないため判定できません' : `目標の${pct}%${nextStep ? `（${nextStep}）` : '（最高ランク）'}`}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Mark on={today.sleepReached} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>睡眠{today.sleepReached ? ' 達成' : ''}</Text>
          <Text style={styles.sub}>
            {today.sleepHours !== null
              ? `昨夜 ${today.sleepHours.toFixed(1)}時間 ／ 目標 ${today.sleepGoal}時間`
              : `昨夜の睡眠を記録すると判定します（目標 ${today.sleepGoal}時間）`}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Mark on={today.weightUnits > 0} label={today.weightUnits > 0 ? `-${(today.weightUnits * WEIGHT_STEP_KG).toFixed(1)}` : undefined} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>
            体重{today.weightUnits > 0 ? ` 今週 ${(today.weightUnits * WEIGHT_STEP_KG).toFixed(1)} kg 減を達成` : ''}
          </Text>
          <Text style={styles.sub}>
            {lost === null
              ? '2週間分の記録がそろうと、500gごとに判定します'
              : `7日平均が前の週より ${lost >= 0 ? `${lost.toFixed(2)} kg 減` : `${(-lost).toFixed(2)} kg 増`}` +
                (toNextKg !== null ? ` ／ 次の達成まであと ${toNextKg.toFixed(2)} kg` : '')}
          </Text>
        </View>
      </View>

      {week.length > 0 ? (
        <View style={styles.weekBox}>
          <View style={styles.weekRow}>
            {week.map((d) => (
              <View key={d.date.toDateString()} style={styles.weekDay}>
                <MedalDot medal={d.steps} size={24} />
                <Mark on={d.sleep} size={24} />
                <Text style={styles.weekLabel}>{WEEKDAY[d.date.getDay()]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.sub}>上の段は歩数のメダル、下の段は睡眠の達成です。</Text>
        </View>
      ) : null}

      <Text style={styles.sub}>
        {streak.current > 0 ? `体重を${streak.current}日連続で記録中` : '体重を記録すると連続記録が始まります'}
        {streak.next ? ` ／ あと${streak.next.left}日で${streak.next.days}日バッジ` : ''}
      </Text>
    </View>
  );
}

// A round mark: green with a check when reached, gray otherwise.
function Mark({ on, size = 40, label }: { on: boolean; size?: number; label?: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View
      style={[
        styles.medal,
        { width: size, height: size, borderRadius: size / 2 },
        on ? styles.markOn : styles.medalNone,
      ]}
    >
      <Text style={[styles.medalText, { fontSize: label ? size * 0.3 : size * 0.45 }, !on && styles.medalTextNone]}>
        {label ?? (on ? '✓' : '−')}
      </Text>
    </View>
  );
}

// The badge collection on the Goal tab. Badges once earned stay earned.
export function BadgeShelf({ streak }: { streak: StreakSummary }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.label}>連続記録バッジ</Text>
      <View style={styles.badgeGrid}>
        {STREAK_BADGES.map((days) => {
          const on = streak.earned.includes(days);
          return (
            <View key={days} style={styles.badgeCell} accessibilityLabel={`${days}日連続${on ? ' 獲得済み' : ' 未獲得'}`}>
              <View style={[styles.badge, on ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeNum, !on && styles.badgeNumOff]}>{days}</Text>
                <Text style={[styles.badgeUnit, !on && styles.badgeNumOff]}>日</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.sub}>
        今 {streak.current}日連続 ／ いちばん長い記録 {streak.best}日
      </Text>
      <Text style={styles.sub}>毎日体重を記録すると、続けた日数でバッジがもらえます。</Text>
    </View>
  );
}

const SEEN_KEY = 'celebrated.v1';

// Celebrates each thing once. Several found at the same time are shown one after another.
export function useCelebration(input: {
  stepMedal: Medal;
  sleepReached: boolean;
  weightUnits: number;
  bestStreak: number;
  weekId: string;
  goalReachedKg: number | null;
  ready: boolean;
}): { event: CelebrationEvent | null; close: () => void } {
  const [seen, setSeen] = useState<string[] | null>(null);
  const [queue, setQueue] = useState<CelebrationEvent[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => setSeen(raw ? JSON.parse(raw) : []))
      .catch(() => setSeen([]));
  }, []);

  const { stepMedal, sleepReached, weightUnits, bestStreak, weekId, goalReachedKg, ready } = input;
  useEffect(() => {
    if (!ready || seen === null) return;
    const fresh = celebrationEvents({ stepMedal, sleepReached, weightUnits, bestStreak, weekId, goalReachedKg }).filter(
      (e) => !seen.includes(e.id),
    );
    if (fresh.length === 0) return;
    const next = pruneSeen([...seen, ...fresh.map((e) => e.id)]);
    setSeen(next);
    setQueue((q) => [...q, ...fresh]);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
  }, [stepMedal, sleepReached, weightUnits, bestStreak, weekId, goalReachedKg, ready, seen]);

  const close = useCallback(() => setQueue((q) => q.slice(1)), []);
  return { event: queue[0] ?? null, close };
}

const CONFETTI_COLORS = ['#5E9C7A', '#7FB89A', '#D4A93C', '#E58A72', '#A3ABB0', '#F2C94C'];
const GRAND_COLORS = ['#D4A93C', '#F2C94C', '#FFE08A', '#5E9C7A', '#E58A72', '#FFFFFF'];

// Falling paper over the whole screen with a message card. Closes by itself, or on tap.
// The grand version (goal weight reached) has three times the paper in waves for longer,
// a gold card that pulses, and a trophy.
export function Celebration({ event, onClose }: { event: CelebrationEvent; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const fall = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const grand = event.grand === true;
  const count = grand ? 90 : 28;
  const duration = grand ? 6500 : 2600;

  // Fixed start points and spins for each piece, picked once. In the grand version the
  // pieces start at different times, so the paper keeps coming in waves.
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const delay = grand ? Math.random() * 0.65 : Math.random() * 0.25;
        return {
          x: Math.random() * width,
          drift: (Math.random() - 0.5) * (grand ? 200 : 120),
          delay,
          end: grand ? Math.min(1, delay + 0.3 + Math.random() * 0.1) : 1,
          spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * (grand ? 720 : 360)),
          color: (grand ? GRAND_COLORS : CONFETTI_COLORS)[i % 6],
          w: 6 + Math.random() * (grand ? 8 : 6),
          h: 10 + Math.random() * (grand ? 12 : 8),
        };
      }),
    [width, count, grand],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fall, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: grand ? 4 : 5, tension: 80, useNativeDriver: true }),
    ]).start();
    const loop = grand
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        )
      : null;
    loop?.start();
    const t = setTimeout(onClose, grand ? 8000 : 4500);
    return () => {
      clearTimeout(t);
      loop?.stop();
    };
  }, [fall, pop, pulse, onClose, grand, duration]);

  const scale = Animated.multiply(
    pop.interpolate({ inputRange: [0, 1], outputRange: [grand ? 0.4 : 0.7, 1] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, grand ? 1.06 : 1] }),
  );

  return (
    <Pressable
      style={[styles.overlay, grand && styles.overlayGrand]}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="閉じる"
    >
      {pieces.map((p, i) => {
        const translateY = fall.interpolate({
          inputRange: p.end < 1 ? [0, p.delay, p.end, 1] : [0, p.delay, 1],
          outputRange: p.end < 1 ? [-40, -40, height + 40, height + 40] : [-40, -40, height + 40],
          easing: Easing.out(Easing.quad),
        });
        const translateX = fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.piece,
              {
                left: p.x,
                width: p.w,
                height: p.h,
                backgroundColor: p.color,
                transform: [{ translateY }, { translateX }, { rotate }],
              },
            ]}
          />
        );
      })}
      <Animated.View style={[styles.popCard, grand && styles.popCardGrand, { opacity: pop, transform: [{ scale }] }]}>
        {grand ? (
          <Text style={styles.trophy}>🏆</Text>
        ) : event.medal ? (
          <MedalDot medal={event.medal} size={72} />
        ) : (
          <Text style={styles.popIcon}>🎉</Text>
        )}
        <Text style={[styles.popTitle, grand && styles.popTitleGrand]}>{event.title}</Text>
        <Text style={styles.popMessage}>{event.message}</Text>
        <Text style={styles.popHint}>タップで閉じる</Text>
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, gap: 10 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: p.fg },
    label: { color: p.muted, fontSize: 14, fontWeight: '700' },
    sub: { fontSize: 13, color: p.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    flex: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 15, fontWeight: '800', color: p.fg },
    markOn: { backgroundColor: p.accent },
    weekBox: { gap: 6, marginTop: 2 },
    medal: { alignItems: 'center', justifyContent: 'center' },
    medalNone: { backgroundColor: p.line },
    medalText: { color: '#FFFFFF', fontWeight: '800' },
    medalTextNone: { color: p.muted },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekDay: { alignItems: 'center', gap: 4 },
    weekLabel: { fontSize: 12, color: p.muted, fontWeight: '700' },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
    badgeCell: { width: '33.33%', alignItems: 'center' },
    badge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 1,
    },
    badgeOn: { backgroundColor: p.accent },
    badgeOff: { backgroundColor: p.bg, borderWidth: 2, borderColor: p.line, borderStyle: 'dashed' },
    badgeNum: { color: p.onAccent, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
    badgeUnit: { color: p.onAccent, fontSize: 12, fontWeight: '800', marginTop: 6 },
    badgeNumOff: { color: p.placeholder },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    overlayGrand: { backgroundColor: 'rgba(0,0,0,0.45)' },
    popCardGrand: { borderWidth: 3, borderColor: '#D4A93C', paddingVertical: 32 },
    trophy: { fontSize: 72 },
    popTitleGrand: { fontSize: 28, color: '#B8892A' },
    piece: { position: 'absolute', top: 0, borderRadius: 2 },
    popCard: {
      backgroundColor: p.surface,
      borderRadius: 20,
      paddingVertical: 24,
      paddingHorizontal: 28,
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 32,
    },
    popIcon: { fontSize: 48 },
    popTitle: { fontSize: 22, fontWeight: '800', color: p.fg, textAlign: 'center' },
    popMessage: { fontSize: 14, color: p.muted, textAlign: 'center' },
    popHint: { fontSize: 12, color: p.placeholder, marginTop: 4 },
  });
