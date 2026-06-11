export const DEFAULT_TAG_COLORS = [
	'#3b82f6',
	'#10b981',
	'#f59e0b',
	'#ef4444',
	'#8b5cf6',
	'#06b6d4',
	'#ec4899',
	'#84cc16'
] as const;

export function tagDefaultColor(index: number): string {
	return DEFAULT_TAG_COLORS[index % DEFAULT_TAG_COLORS.length]!;
}

export function tagColor(
	tagColors: Record<string, string> | undefined,
	tag: string,
	index: number
): string {
	return tagColors?.[tag] ?? tagDefaultColor(index);
}
