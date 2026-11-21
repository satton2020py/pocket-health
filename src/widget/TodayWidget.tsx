import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';

export const WIDGET_NAME = 'Today';

// Cream and green, matching the app. The widget has its own colors because it cannot
// use the app's theme code.
const light = { bg: '#F7F4EC', fg: '#2B2F2A', muted: '#7A8077', accent: '#5E9C7A' } as const;
const dark = { bg: '#252823', fg: '#ECEAE3', muted: '#A3A99F', accent: '#6FB08C' } as const;

const pad = (n: number) => String(n).padStart(2, '0');

// Today's steps and the 7-day average weight. Tapping it opens the app on the Today tab,
// where the weight can be recorded.
function TodayWidgetView({ s, c }: { s: WidgetSnapshot | null; c: typeof light | typeof dark }) {
  const updated = s ? new Date(s.updatedAt) : null;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.bg,
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <TextWidget text="ポケットヘルス" style={{ fontSize: 13, color: c.muted, fontWeight: '700' }} />
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget
          text={s?.steps != null ? `${s.steps.toLocaleString('ja-JP')} 歩` : '歩数 —'}
          style={{ fontSize: 24, color: c.fg, fontWeight: '800' }}
        />
        <TextWidget
          text={s ? `目標 ${s.stepGoal.toLocaleString('ja-JP')}歩` : 'アプリを開くと表示されます'}
          style={{ fontSize: 12, color: c.muted }}
        />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget
          text={s?.averageKg != null ? `体重 ${s.averageKg.toFixed(2)} kg（7日平均）` : '体重 —'}
          style={{ fontSize: 15, color: c.fg, fontWeight: '700' }}
        />
        {s?.remainingKg != null ? (
          <TextWidget
            text={s.remainingKg > 0 ? `目標まであと ${s.remainingKg.toFixed(2)} kg` : '目標に到達しています'}
            style={{ fontSize: 12, color: c.accent, fontWeight: '700' }}
          />
        ) : null}
      </FlexWidget>
      <TextWidget
        text={updated ? `${updated.getHours()}:${pad(updated.getMinutes())} 時点・タップで記録` : 'タップで開く'}
        style={{ fontSize: 11, color: c.muted }}
      />
    </FlexWidget>
  );
}

export function renderTodayWidget(s: WidgetSnapshot | null) {
  return {
    light: <TodayWidgetView s={s} c={light} />,
    dark: <TodayWidgetView s={s} c={dark} />,
  };
}
