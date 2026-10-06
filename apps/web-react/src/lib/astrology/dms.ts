/** Signed degrees/minutes/seconds, e.g. `-0°01'29"` for a retrograde daily motion. */
export function formatSignedDms(valueDegrees: number): string {
	const sign = valueDegrees < 0 ? '-' : '';
	const abs = Math.abs(valueDegrees);
	const totalSeconds = Math.round(abs * 3600);
	const degrees = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${sign}${degrees}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(2, '0')}"`;
}
