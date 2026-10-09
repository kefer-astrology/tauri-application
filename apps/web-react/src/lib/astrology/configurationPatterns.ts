/** Mirrors `domain::configurations`' four built-in role topologies (Grand Trine, T-square, Yod,
 *  Grand Cross) — role *names* only, purely for UI labeling and per-role fixed/moving toggles.
 *  The actual aspect/orb/automorphism logic stays entirely server-side; nothing here duplicates
 *  detection, only the static list of role names a pattern exposes.
 *
 *  `yod` is this contract's name for the same geometry the existing snapshot classifier and
 *  workspace catalog call `double_quincunx` (two quincunxes plus one sextile) — see the
 *  transit-series contract for the full correspondence. */
export type ConfigurationPatternId = 'grand_trine' | 't_square' | 'yod' | 'grand_cross';

export interface ConfigurationPatternDefinition {
	id: ConfigurationPatternId;
	/** i18n key for the pattern's display name. */
	labelKey: string;
	roles: string[];
}

export const CONFIGURATION_PATTERNS: ConfigurationPatternDefinition[] = [
	{ id: 'grand_trine', labelKey: 'transits_configuration_grand_trine', roles: ['a', 'b', 'c'] },
	{
		id: 't_square',
		labelKey: 'transits_configuration_t_square',
		roles: ['apex', 'pole_a', 'pole_b']
	},
	{ id: 'yod', labelKey: 'transits_configuration_yod', roles: ['apex', 'base_a', 'base_b'] },
	{
		id: 'grand_cross',
		labelKey: 'transits_configuration_grand_cross',
		roles: ['a1', 'a2', 'b1', 'b2']
	}
];

export function configurationPattern(
	id: ConfigurationPatternId
): ConfigurationPatternDefinition | undefined {
	return CONFIGURATION_PATTERNS.find((pattern) => pattern.id === id);
}
