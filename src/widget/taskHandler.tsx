import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadSnapshot } from './snapshot';
import { renderTodayWidget, WIDGET_NAME } from './TodayWidget';

// Runs when Android asks the widget to draw (added, resized, or every 30 minutes).
// It draws the numbers the app saved last.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== WIDGET_NAME) return;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(renderTodayWidget(await loadSnapshot()));
      break;
    default:
      break;
  }
}
