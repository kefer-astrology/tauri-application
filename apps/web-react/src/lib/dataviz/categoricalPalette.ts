import type { Theme } from '@/app/components/astrology-sidebar';

/**
 * Generic series colors come from the active app theme. These are deliberately not the aspect
 * colors: folded-angle series represent bodies, while transit series represent body pairs, so
 * assigning them aspect semantics would make unrelated series look equivalent.
 *
 * `themePaletteVars` resolves these tokens from the active sunrise/noon/twilight/midnight
 * palette, including user-edited palette values.
 */
const CATEGORICAL_TOKENS = [
	'var(--token-viz-1)',
	'var(--token-viz-2)',
	'var(--token-viz-3)',
	'var(--token-viz-4)'
] as const;

export const CATEGORICAL_PALETTE_SIZE = CATEGORICAL_TOKENS.length;

export function categoricalPaletteForTheme(_theme: Theme): readonly string[] {
	return CATEGORICAL_TOKENS;
}
