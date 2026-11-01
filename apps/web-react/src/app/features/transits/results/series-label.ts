import type { AspectTimelineSeries } from '@/lib/astrology/aspectTimeline';
import { aspectLabel, objectLabel } from '@/lib/astrology/objectLabels';

/** `Saturn Square Pluto` — a timeline series as text. */
export function seriesLabel(series: AspectTimelineSeries, t: (key: string) => string): string {
	return `${objectLabel(series.from, t)} ${aspectLabel(series.aspectType, t)} ${objectLabel(series.to, t)}`;
}
