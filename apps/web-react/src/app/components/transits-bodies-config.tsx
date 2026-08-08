import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

const PLANET_GLYPH_FALLBACK: Record<string, string> = {
	sun: '☉',
	moon: '☽',
	mercury: '☿',
	venus: '♀',
	mars: '♂',
	jupiter: '♃',
	saturn: '♄',
	uranus: '♅',
	neptune: '♆',
	pluto: '♇'
};

type TransitsBodiesConfigProps = {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	titleKey: 'transits_heading_transiting' | 'transits_heading_transited';
	subtitleKey: 'transits_subtitle_transiting' | 'transits_subtitle_transited';
	selectedBodyIds: string[];
	onSelectedBodyIdsChange: (ids: string[]) => void;
};

type TransitBodyItem =
	| { labelKey: string; label?: never; glyphId?: string; bodyId?: string }
	| { label: string; labelKey?: never; glyphId?: never; bodyId?: string };

type TransitBodyGroup = {
	id: string;
	labelKey: string;
	minHeightClass: string;
	items: TransitBodyItem[];
};

const TRANSIT_BODY_COLUMNS: TransitBodyGroup[][] = [
	[
		{
			id: 'luminaries',
			labelKey: 'transits_group_luminaries',
			minHeightClass: 'min-h-[116px]',
			items: [
				{ labelKey: 'planet_sun', glyphId: 'sun' },
				{ labelKey: 'planet_moon', glyphId: 'moon' }
			]
		},
		{
			id: 'lunar-nodes',
			labelKey: 'transits_group_lunar_nodes',
			minHeightClass: 'min-h-[88px]',
			items: [
				{ labelKey: 'transits_node_mean', bodyId: 'north_node' },
				{ labelKey: 'transits_node_true', bodyId: 'true_north_node' }
			]
		}
	],
	[
		{
			id: 'personal-planets',
			labelKey: 'transits_group_personal_planets',
			minHeightClass: 'min-h-[116px]',
			items: [
				{ labelKey: 'planet_mercury', glyphId: 'mercury' },
				{ labelKey: 'planet_venus', glyphId: 'venus' },
				{ labelKey: 'planet_mars', glyphId: 'mars' }
			]
		},
		{
			id: 'lunar-apsides',
			labelKey: 'transits_group_lunar_apsides',
			minHeightClass: 'min-h-[88px]',
			items: [
				{ labelKey: 'transits_black_moon_mean' },
				{ labelKey: 'transits_black_moon_natural' },
				{ labelKey: 'transits_black_moon_osc' }
			]
		}
	],
	[
		{
			id: 'social',
			labelKey: 'transits_group_social',
			minHeightClass: 'min-h-[116px]',
			items: [
				{ labelKey: 'planet_jupiter', glyphId: 'jupiter' },
				{ labelKey: 'planet_saturn', glyphId: 'saturn' }
			]
		},
		{
			id: 'tno',
			labelKey: 'transits_group_tno',
			minHeightClass: 'min-h-[88px]',
			items: ['⯰ Eris', '⯲ Sedna', '⯳ Haumea', '⯴ Makemake', '⯵ Quaoar', '⯶ Orcus', '⯷ Varuna'].map(
				(label) => ({ label })
			)
		}
	],
	[
		{
			id: 'transpersonal',
			labelKey: 'transits_group_transpersonal',
			minHeightClass: 'min-h-[116px]',
			items: [
				{ labelKey: 'planet_uranus', glyphId: 'uranus' },
				{ labelKey: 'planet_neptune', glyphId: 'neptune' },
				{ labelKey: 'planet_pluto', glyphId: 'pluto' }
			]
		},
		{
			id: 'asteroids',
			labelKey: 'transits_group_asteroids',
			minHeightClass: 'min-h-[88px]',
			items: [
				{ label: '⚳ Ceres', bodyId: 'ceres' },
				{ label: '⚴ Pallas', bodyId: 'pallas' },
				{ label: '⚵ Juno', bodyId: 'juno' },
				{ label: '⚶ Vesta', bodyId: 'vesta' },
				{ label: '⚷ Chiron', bodyId: 'chiron' },
				{ label: '⯛ Pholus' }
			]
		}
	]
];

const TRANSIT_BOTTOM_GROUPS: TransitBodyGroup[] = [
	{
		id: 'geo-nodes',
		labelKey: 'transits_group_geo_nodes',
		minHeightClass: '',
		items: [
			'transits_geo_mercury',
			'transits_geo_saturn',
			'transits_geo_venus',
			'transits_geo_uranus',
			'transits_geo_mars',
			'transits_geo_neptune',
			'transits_geo_jupiter',
			'transits_geo_pluto'
		].map((labelKey) => ({ labelKey }))
	},
	{
		id: 'hypotheticals',
		labelKey: 'transits_group_hypotheticals',
		minHeightClass: '',
		items: ['⚻ Cupido', '⯛ Apollon', '⯚ Hades', '⯰ Admetos', '⯙ Zeus', '⯲ Vulcanus', '⯘ Kronos', '⯰ Poseidon'].map(
			(label) => ({ label })
		)
	}
];

function getBodyId(item: TransitBodyItem): string | null {
	if (item.bodyId) return item.bodyId;
	if ('glyphId' in item && item.glyphId) return item.glyphId;
	return null;
}

export function TransitsBodiesConfig({
	theme,
	glyphSet,
	titleKey,
	subtitleKey,
	selectedBodyIds,
	onSelectedBodyIdsChange
}: TransitsBodiesConfigProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);

	const renderItemLabel = (item: TransitBodyItem) => {
		if ('label' in item) return item.label;
		if (!item.glyphId) return t(item.labelKey);
		return (
			<span className={cn('inline-flex items-center gap-1.5 text-sm', ft.bodyText)}>
				<AstrologyGlyph
					glyphId={item.glyphId}
					glyphSet={glyphSet}
					fallback={PLANET_GLYPH_FALLBACK[item.glyphId] ?? item.glyphId.charAt(0).toUpperCase()}
					size={16}
					className="shrink-0"
				/>
				{t(item.labelKey)}
			</span>
		);
	};

	const renderCheckboxRow = (
		id: string,
		content: ReactNode,
		options: {
			strong?: boolean;
			compact?: boolean;
			checked?: boolean;
			disabled?: boolean;
			unsupported?: boolean;
			onCheckedChange?: (checked: boolean) => void;
		} = {}
	) => (
		<Label
			key={id}
			htmlFor={id}
			title={options.unsupported ? t('transits_body_unsupported_hint') : undefined}
			className={cn(
				'flex items-center space-x-2',
				options.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
				options.compact ? 'h-5' : 'mb-3',
				options.strong ? ft.label : ft.bodyText
			)}
		>
			<Checkbox
				id={id}
				className={cn('h-4 w-4 shrink-0 rounded', ft.checkboxAccent)}
				checked={options.checked}
				disabled={options.disabled}
				onCheckedChange={(checked) => options.onCheckedChange?.(checked === true)}
			/>
			<span className={cn('text-sm', options.strong && 'font-semibold')}>{content}</span>
			{options.unsupported && (
				<span className={cn('text-xs italic', ft.muted)}>
					({t('transits_body_unsupported_hint')})
				</span>
			)}
		</Label>
	);

	const setBodySelection = (bodyId: string, checked: boolean) => {
		const next = checked
			? Array.from(new Set([...selectedBodyIds, bodyId]))
			: selectedBodyIds.filter((id) => id !== bodyId);
		onSelectedBodyIdsChange(next);
	};

	const setGroupSelection = (bodyIds: string[], checked: boolean) => {
		const next = checked
			? Array.from(new Set([...selectedBodyIds, ...bodyIds]))
			: selectedBodyIds.filter((id) => !bodyIds.includes(id));
		onSelectedBodyIdsChange(next);
	};

	const renderGroup = (group: TransitBodyGroup) => {
		const groupBodyIds = group.items.map(getBodyId).filter((id): id is string => Boolean(id));
		const groupSelected =
			groupBodyIds.length > 0 && groupBodyIds.every((id) => selectedBodyIds.includes(id));

		return (
			<div key={group.id} className={group.minHeightClass}>
				{renderCheckboxRow(`transit-group-${group.id}`, t(group.labelKey), {
					strong: true,
					checked: groupSelected,
					disabled: groupBodyIds.length === 0,
					unsupported: groupBodyIds.length === 0,
					onCheckedChange: (checked) => setGroupSelection(groupBodyIds, checked)
				})}
				<div className="ml-6 flex flex-col gap-2">
					{group.items.map((item, index) => {
						const bodyId = getBodyId(item);
						return renderCheckboxRow(
							`transit-item-${group.id}-${'label' in item ? item.label : item.labelKey}-${index}`,
							renderItemLabel(item),
							{
								compact: true,
								checked: bodyId ? selectedBodyIds.includes(bodyId) : false,
								disabled: !bodyId,
								unsupported: !bodyId,
								onCheckedChange: bodyId
									? (checked) => setBodySelection(bodyId, checked)
									: undefined
							}
						);
					})}
				</div>
			</div>
		);
	};

	return (
		<Card variant="ghost" className="w-full rounded-xl">
			<CardContent className="p-6 md:p-8">
				<div className="mb-8">
					<h1 className={cn('mb-2 text-2xl font-semibold', ft.title)}>{t(titleKey)}</h1>
					<p className={cn('text-sm', ft.muted)}>{t(subtitleKey)}</p>
				</div>

				<div className="mb-8 grid grid-cols-4 gap-8">
					{TRANSIT_BODY_COLUMNS.map((column, index) => (
						<div key={index} className="flex flex-col gap-6">
							{column.map(renderGroup)}
						</div>
					))}
				</div>

				<div className="mb-8 grid grid-cols-2 gap-8">
					{TRANSIT_BOTTOM_GROUPS.map((group) => {
						const groupBodyIds = group.items.map(getBodyId).filter((id): id is string => Boolean(id));
						const groupSelected =
							groupBodyIds.length > 0 && groupBodyIds.every((id) => selectedBodyIds.includes(id));

						return (
							<div key={group.id}>
								{renderCheckboxRow(`transit-group-${group.id}`, t(group.labelKey), {
									strong: true,
									checked: groupSelected,
									disabled: groupBodyIds.length === 0,
									unsupported: groupBodyIds.length === 0,
									onCheckedChange: (checked) => setGroupSelection(groupBodyIds, checked)
								})}
								<div className="ml-6 grid grid-cols-2 gap-x-8 gap-y-2">
									{group.items.map((item, index) => {
										const bodyId = getBodyId(item);
										return renderCheckboxRow(
											`transit-item-${group.id}-${'label' in item ? item.label : item.labelKey}-${index}`,
											renderItemLabel(item),
											{
												checked: bodyId ? selectedBodyIds.includes(bodyId) : false,
												disabled: !bodyId,
												unsupported: !bodyId,
												onCheckedChange: bodyId
													? (checked) => setBodySelection(bodyId, checked)
													: undefined
											}
										);
									})}
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex items-center justify-center gap-4 pt-6">
					<Button type="button" variant="outline" className={cn(ft.footerCancel, '!flex-none text-sm')}>
						{t('button_close')}
					</Button>
					<Button type="button" className={cn(ft.footerPrimary, '!flex-none text-sm')}>
						{t('button_ok')}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
