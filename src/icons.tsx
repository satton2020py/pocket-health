import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number };

// Small line icons for the bottom tabs, drawn with SVG so no icon font is needed.
export function TodayIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function RecordsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3v18h18" />
      <Path d="M7 15l4-4 3 3 5-6" />
    </Svg>
  );
}

export function GoalIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={5} />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <Rect x={14} y={4} width={4} height={4} rx={2} />
      <Rect x={8} y={10} width={4} height={4} rx={2} />
      <Rect x={16} y={16} width={4} height={4} rx={2} />
    </Svg>
  );
}
