// Ported from apps/web-react/src/lib/chartTags.ts to keep tag color defaults in sync.

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

export function tagColor(tagColors: Record<string, string> | undefined, tag: string, index: number): string {
  return tagColors?.[tag] ?? tagDefaultColor(index);
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function mergeTags(existing: string[], incoming: string[]): string[] {
  const next = [...existing];
  for (const tag of incoming) {
    if (!next.includes(tag)) next.push(tag);
  }
  return next;
}
