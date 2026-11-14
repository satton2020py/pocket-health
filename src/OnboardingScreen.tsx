import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Palette, useStyles } from './theme';

// Shown once, on first launch, before the app asks Health Connect for anything.
// It says what is read and why, so the permission screen that follows is not a surprise.
export function OnboardingScreen({ onAllow, onSkip }: { onAllow: () => void; onSkip: () => void }) {
  const styles = useStyles(makeStyles);
  const items: [string, string][] = [
    ['歩数・距離・消費カロリー', '今日の画面と7日間のグラフに表示します（読み取りのみ）。'],
    ['睡眠', '昨夜の睡眠と7日間の記録に表示します。睡眠を手で入力したときだけ、Health Connectに書き込みます。'],
    ['体重', '体組成計のアプリがHealth Connectに保存した体重を取り込みます（読み取りのみ）。記録はこの端末に保存し、ログインした場合だけあなた専用のクラウドに保存します。'],
  ];
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>ポケットヘルスへようこそ</Text>
      <Text style={styles.lead}>
        体重と睡眠を、登録なしで軽く記録するアプリです。歩数と睡眠はスマホのHealth Connectから読み取ります。
      </Text>
      <View style={styles.card}>
        {items.map(([name, body]) => (
          <View key={name} style={styles.item}>
            <Text style={styles.itemName}>{name}</Text>
            <Text style={styles.sub}>{body}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.sub}>
        データを広告や第三者に渡すことはありません。許可はあとから設定タブで変えられます。
      </Text>
      <Pressable onPress={onAllow} accessibilityRole="button" style={styles.cta}>
        <Text style={styles.ctaText}>Health Connectを許可して始める</Text>
      </Pressable>
      <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip}>
        <Text style={styles.skipText}>許可せずに始める</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: 16, paddingBottom: 32 },
    title: { fontSize: 24, fontWeight: '800', color: p.fg },
    lead: { fontSize: 15, color: p.fg, lineHeight: 22 },
    card: { backgroundColor: p.surface, borderRadius: 16, padding: 16, gap: 14 },
    item: { gap: 4 },
    itemName: { fontSize: 15, fontWeight: '800', color: p.fg },
    sub: { fontSize: 13, color: p.muted, lineHeight: 19 },
    cta: { backgroundColor: p.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
    ctaText: { color: p.onAccent, fontSize: 16, fontWeight: '800' },
    skip: { alignItems: 'center', paddingVertical: 10 },
    skipText: { color: p.muted, fontSize: 14, fontWeight: '700' },
  });
