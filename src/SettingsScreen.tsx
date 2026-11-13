import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from './theme';
import { sourceLabel } from './TodayScreen';
import type { StepSource } from './healthConnect';

type Props = {
  sources: StepSource[];
  chosen: string | null;
  onSelectSource: (origin: string) => void;
  syncMessage: string | null;
  onResync: () => void;
};

// Settings. Choosing which app's step count to use lives here, not on the Today screen.
export function SettingsScreen({
  sources,
  chosen,
  onSelectSource,
  syncMessage,
  onResync,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>設定</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>歩数のデータ元</Text>
        {sources.length === 0 ? (
          <Text style={styles.sub}>
            Health Connectから、まだ歩数を読み取れていません。今日タブの「Health Connectから再取得」を押してください。
          </Text>
        ) : (
          <>
            <Text style={styles.sub}>
              同じ歩数が重ならないよう、1つのアプリの数字だけを使っています。
            </Text>
            <View style={styles.sourceRow}>
              {sources.map((s) => {
                const on = s.origin === chosen;
                return (
                  <Pressable
                    key={s.origin}
                    onPress={() => onSelectSource(s.origin)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.sourcePill, on && styles.sourcePillOn]}
                  >
                    <Text style={[styles.sourceText, on && styles.sourceTextOn]}>
                      {sourceLabel(s.origin)} {s.total.toLocaleString('ja-JP')}歩
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Connect</Text>
        <Pressable onPress={onResync} accessibilityRole="button" style={styles.resyncBtn}>
          <Text style={styles.resyncText}>Health Connectから再取得</Text>
        </Pressable>
        {syncMessage ? <Text style={styles.sub}>{syncMessage}</Text> : null}
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.fg,
  },
  sub: {
    fontSize: 13,
    color: palette.muted,
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  sourcePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
  },
  sourcePillOn: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  sourceText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  sourceTextOn: {
    color: '#FFFFFF',
  },
  resyncBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  resyncText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
