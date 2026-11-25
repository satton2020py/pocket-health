import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { type Palette, usePalette, useStyles } from './theme';
import {
  celebrationEvents,
  type CelebrationEvent,
  type DayGoals,
  type DayMedal,
  MEDAL_LABEL,
  type Medal,
  pruneSeen,
  STREAK_BADGES,
  type StreakSummary,
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

// Today's medal on the Today tab: which of the three daily goals are met, the medal
// they earn, the last 7 days of medals, and the record streak.
export function MedalCard({
  today,
  week,
  streak,
}: {
  today: DayGoals;
  week: DayMedal[];
  streak: StreakSummary;
}) {
  const styles = useStyles(makeStyles);
  const n = Number(today.steps) + Number(today.sleep) + Number(today.weight);
  const medal: Medal = n === 3 ? 'gold' : n === 2 ? 'silver' : n === 1 ? 'bronze' : null;
  const left = 3 - n;

  const check = (on: boolean, label: string) => (
    <View style={[styles.goalChip, on && styles.goalChipOn]}>
      <Text style={[styles.goalChipText, on && styles.goalChipTextOn]}>
        {on ? '✓ ' : ''}
        {label}
      </Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>今日のメダル</Text>
      <View style={styles.row}>
        <MedalDot medal={medal} size={56} />
        <View style={styles.flex}>
          <Text style={styles.headline}>
            {medal ? `${MEDAL_LABEL[medal]}メダル` : 'まだメダルなし'}
          </Text>
          <Text style={styles.sub}>
            {left === 0
              ? '3つすべて達成しました'
              : medal === 'silver'
                ? 'あと1つで金メダル'
                : `あと${left}つで金メダル`}
          </Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        {check(today.steps, '歩数')}
        {check(today.sleep, '睡眠')}
        {check(today.weight, '体重を記録')}
      </View>

      {week.length > 0 ? (
        <View style={styles.weekRow}>
          {week.map((d) => (
            <View key={d.date.toDateString()} style={styles.weekDay}>
              <MedalDot medal={d.medal} size={26} />
              <Text style={styles.weekLabel}>{WEEKDAY[d.date.getDay()]}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.sub}>
        {streak.current > 0 ? `体重を${streak.current}日連続で記録中` : '体重を記録すると連続記録が始まります'}
        {streak.next ? ` ／ あと${streak.next.left}日で${streak.next.days}日バッジ` : ''}
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

// Picks the next thing to celebrate, once each. All events found at the same time are
// marked as seen together, so one moment shows one celebration.
export function useCelebration(input: {
  today: DayGoals;
  stepsKnown: boolean;
  bestStreak: number;
  ready: boolean;
}): { event: CelebrationEvent | null; close: () => void } {
  const [seen, setSeen] = useState<string[] | null>(null);
  const [event, setEvent] = useState<CelebrationEvent | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => setSeen(raw ? JSON.parse(raw) : []))
      .catch(() => setSeen([]));
  }, []);

  const { today, stepsKnown, bestStreak, ready } = input;
  useEffect(() => {
    if (!ready || seen === null || event) return;
    const fresh = celebrationEvents({ today, stepsKnown, bestStreak }).filter((e) => !seen.includes(e.id));
    if (fresh.length === 0) return;
    const next = pruneSeen([...seen, ...fresh.map((e) => e.id)]);
    setSeen(next);
    setEvent(fresh[0]);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
  }, [today.steps, today.sleep, today.weight, stepsKnown, bestStreak, ready, seen, event]);

  const close = useCallback(() => setEvent(null), []);
  return { event, close };
}

const CONFETTI_COLORS = ['#5E9C7A', '#7FB89A', '#D4A93C', '#E58A72', '#A3ABB0', '#F2C94C'];
const PIECES = 28;

// A short burst of falling paper over the whole screen with a message card.
// Closes by itself after a few seconds, or on tap.
export function Celebration({ event, onClose }: { event: CelebrationEvent; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const fall = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  // Fixed start points and spins for each piece, picked once.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.25,
        spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 8,
      })),
    [width],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [fall, pop, onClose]);

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="閉じる">
      {pieces.map((p, i) => {
        const start = p.delay;
        const translateY = fall.interpolate({
          inputRange: [0, start, 1],
          outputRange: [-40, -40, height + 40],
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
      <Animated.View
        style={[
          styles.popCard,
          { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
        ]}
      >
        {event.medal ? <MedalDot medal={event.medal} size={72} /> : <Text style={styles.popIcon}>🎉</Text>}
        <Text style={styles.popTitle}>{event.title}</Text>
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
    headline: { fontSize: 20, fontWeight: '800', color: p.fg },
    medal: { alignItems: 'center', justifyContent: 'center' },
    medalNone: { backgroundColor: p.line },
    medalText: { color: '#FFFFFF', fontWeight: '800' },
    medalTextNone: { color: p.muted },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    goalChip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: p.line },
    goalChipOn: { backgroundColor: p.accent },
    goalChipText: { fontSize: 13, fontWeight: '700', color: p.muted },
    goalChipTextOn: { color: p.onAccent },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
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
