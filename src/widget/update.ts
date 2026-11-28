import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { saveSnapshot, type WidgetSnapshot } from './snapshot';
import { renderTodayWidget, WIDGET_NAME } from './TodayWidget';

// Saves the numbers and redraws any widget on the home screen. Does nothing on the web
// or iPhone, and never fails the app when no widget is placed.
export async function updateWidget(s: WidgetSnapshot): Promise<void> {
  await saveSnapshot(s);
  if (Platform.OS !== 'android') return;
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => renderTodayWidget(s),
      widgetNotFound: () => {},
    });
  } catch {
    // No widget, or the widget module is missing in this build.
  }
}
