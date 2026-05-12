import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { Theme } from './astrology-sidebar';
import { DetailSidePanel } from './detail-side-panel';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import {
	DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS,
	OBSERVABLE_OBJECTS
} from '@/lib/astrology/observableObjects';
import {
	ASPECT_ROWS,
	DEFAULT_ASPECT_COLORS
} from '@/lib/astrology/aspects';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';

interface AspectariumProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	workspaceDefaults: WorkspaceDefaultsState;
}

interface ParsedAspect {
	from: string;
	to: string;
	type: string;
	orb: number;
	angle?: number;
	exactAngle?: number;
	applying?: boolean;
	separating?: boolean;
}

const ZODIAC_UNICODE_FALLBACK = [
	'♈',
	'♉',
	'♊',
	'♋',
	'♌',
	'♍',
	'♎',
	'♏',
	'♐',
	'♑',
	'♒',
	'♓'
] as const;

const BODY_META: Record<
	string,
	{ labelKey?: string; fallbackLabel: string; icon: string; glyphDomain?: 'planet' | 'zodiac' }
> = {
	sun: { labelKey: 'planet_sun', fallbackLabel: 'Sun', icon: '☉' },
	moon: { labelKey: 'planet_moon', fallbackLabel: 'Moon', icon: '☽' },
	mercury: { labelKey: 'planet_mercury', fallbackLabel: 'Mercury', icon: '☿' },
	venus: { labelKey: 'planet_venus', fallbackLabel: 'Venus', icon: '♀' },
	mars: { labelKey: 'planet_mars', fallbackLabel: 'Mars', icon: '♂' },
	jupiter: { labelKey: 'planet_jupiter', fallbackLabel: 'Jupiter', icon: '♃' },
	saturn: { labelKey: 'planet_saturn', fallbackLabel: 'Saturn', icon: '♄' },
	uranus: { labelKey: 'planet_uranus', fallbackLabel: 'Uranus', icon: '♅' },
	neptune: { labelKey: 'planet_neptune', fallbackLabel: 'Neptune', icon: '♆' },
	pluto: { labelKey: 'planet_pluto', fallbackLabel: 'Pluto', icon: '♇' },
	asc: { labelKey: 'point_asc', fallbackLabel: 'Asc', icon: 'Asc' },
	desc: { labelKey: 'point_dsc', fallbackLabel: 'Dsc', icon: 'Dsc' },
	mc: { fallbackLabel: 'MC', icon: 'MC' },
	ic: { fallbackLabel: 'IC', icon: 'IC' },
	north_node: { fallbackLabel: 'North Node', icon: '☊' },
	south_node: { fallbackLabel: 'South Node', icon: '☋' },
	true_north_node: { fallbackLabel: 'True North Node', icon: '☊' },
	true_south_node: { fallbackLabel: 'True South Node', icon: '☋' },
	lilith: { fallbackLabel: 'Lilith', icon: '⚸' },
	chiron: { fallbackLabel: 'Chiron', icon: '⚷' },
	ceres: { fallbackLabel: 'Ceres', icon: 'Ce' },
	pallas: { fallbackLabel: 'Pallas', icon: 'Pa' },
	juno: { fallbackLabel: 'Juno', icon: 'Ju' },
	vesta: { fallbackLabel: 'Vesta', icon: 'Ve' }
};

const ASPECT_GLYPHS: Record<string, string> = {
	conjunction: '☌',
	sextile: '⚹',
	square: '□',
	trine: '△',
	quincunx: '⚻',
	opposition: '☍'
};

const OBSERVABLE_OBJECT_ICON_MAP = new Map(OBSERVABLE_OBJECTS.map((item) => [item.id, item.icon] as const));
const ASPECT_LABEL_KEY_MAP = new Map<string, string>(
	ASPECT_ROWS.map((aspect) => [aspect.id, aspect.labelKey] as const)
);

function normalizeLongitude(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return ((value % 360) + 360) % 360;
	}
	if (value && typeof value === 'object') {
		const longitude = (value as { longitude?: unknown }).longitude;
		if (typeof longitude === 'number' && Number.isFinite(longitude)) {
			return ((longitude % 360) + 360) % 360;
		}
	}
	return null;
}

function parseAspect(raw: unknown): ParsedAspect | null {
	if (!raw || typeof raw !== 'object') return null;
	const aspect = raw as Record<string, unknown>;
	const from = typeof aspect.from === 'string' ? aspect.from : null;
	const to = typeof aspect.to === 'string' ? aspect.to : null;
	const type = typeof aspect.type === 'string' ? aspect.type : null;
	const orbRaw = aspect.orb;
	const angleRaw = aspect.angle;
	const exactAngleRaw = aspect.exact_angle;
	if (!from || !to || !type) return null;
	const orb =
		typeof orbRaw === 'number'
			? orbRaw
			: typeof orbRaw === 'string'
				? Number(orbRaw)
				: NaN;
	if (!Number.isFinite(orb)) return null;
	return {
		from,
		to,
		type,
		orb,
		angle: typeof angleRaw === 'number' && Number.isFinite(angleRaw) ? angleRaw : undefined,
		exactAngle:
			typeof exactAngleRaw === 'number' && Number.isFinite(exactAngleRaw) ? exactAngleRaw : undefined,
		applying: aspect.applying === true,
		separating: aspect.separating === true
	};
}

function bodyLabel(id: string, t: (key: string) => string) {
	const meta = BODY_META[id];
	if (!meta) return id;
	return meta.labelKey ? t(meta.labelKey) : meta.fallbackLabel;
}

function bodyIcon(id: string) {
	return BODY_META[id]?.icon ?? OBSERVABLE_OBJECT_ICON_MAP.get(id) ?? id.slice(0, 3);
}

function canonicalPairKey(idA: string, idB: string, orderIndex: Map<string, number>) {
	const idxA = orderIndex.get(idA) ?? Number.MAX_SAFE_INTEGER;
	const idxB = orderIndex.get(idB) ?? Number.MAX_SAFE_INTEGER;
	return idxA <= idxB ? `${idA}::${idB}` : `${idB}::${idA}`;
}

function aspectIdentity(aspect: ParsedAspect, orderIndex: Map<string, number>) {
	return `${canonicalPairKey(aspect.from, aspect.to, orderIndex)}::${aspect.type}`;
}

function formatDegrees(value: number | undefined, digits = 2) {
	if (!Number.isFinite(value)) return null;
	return `${value!.toFixed(digits)}°`;
}

function formatOrb(orb: number | undefined) {
	if (!Number.isFinite(orb)) return null;
	return `${Math.abs(orb!).toFixed(2)}°`;
}

function formatPosition(longitude: number | null) {
	if (longitude === null) return null;
	const normalized = ((longitude % 360) + 360) % 360;
	const signIndex = Math.floor(normalized / 30) % 12;
	const withinSign = normalized % 30;
	const totalMinutes = Math.round(withinSign * 60);
	const degrees = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${ZODIAC_UNICODE_FALLBACK[signIndex] ?? '♈'} ${degrees}°${String(minutes).padStart(2, '0')}′`;
}

function fallbackAspectLabel(type: string) {
	return type.charAt(0).toUpperCase() + type.slice(1).replaceAll('_', ' ');
}

function BodyGlyph({
	bodyId,
	glyphSet,
	className,
	size = 20
}: {
	bodyId: string;
	glyphSet: AstrologyGlyphSetId;
	className?: string;
	size?: number;
}) {
	const fallback = bodyIcon(bodyId);
	const isTextOnly = bodyId === 'asc' || bodyId === 'desc' || bodyId === 'mc' || bodyId === 'ic';
	if (isTextOnly) {
		return (
			<span
				className={cn('inline-flex items-center justify-center leading-none', className)}
				style={{ width: size, height: size }}
			>
				{fallback}
			</span>
		);
	}

	return (
		<AstrologyGlyph
			glyphId={bodyId}
			glyphSet={glyphSet}
			fallback={fallback}
			size={size}
			className={className}
			title={fallback}
		/>
	);
}

function AspectCellButton({
	aspect,
	isSelected,
	onSelect,
	color
}: {
	aspect: ParsedAspect;
	isSelected: boolean;
	onSelect: () => void;
	color: string;
}) {
	return (
		<Button
			type="button"
			onClick={onSelect}
			variant="ghost"
			className={cn(
				'flex aspect-square min-h-16 w-full min-w-16 flex-col items-center justify-center rounded-xl border px-1.5 py-1',
				isSelected
					? 'border-[color:var(--theme-accent)] bg-[color:var(--theme-soft-bg)] shadow-sm'
					: 'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] hover:bg-[color:var(--theme-soft-bg)]'
			)}
			aria-pressed={isSelected}
		>
			<span className="text-lg leading-none" style={{ color }}>
				{ASPECT_GLYPHS[aspect.type] ?? '•'}
			</span>
			<span className="mt-1 text-[11px] text-[color:var(--theme-content-muted)]">
				{formatOrb(aspect.orb)}
			</span>
		</Button>
	);
}

function DetailRow({
	label,
	value
}: {
	label: string;
	value: string | null;
}) {
	return (
		<div className="flex items-start justify-between gap-3 text-sm">
			<span className="text-[color:var(--theme-content-muted)]">{label}</span>
			<span className="text-right text-[color:var(--theme-content-primary)]">{value ?? '—'}</span>
		</div>
	);
}

export function Aspectarium({ theme, glyphSet, workspaceDefaults }: AspectariumProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const { selectedChart } = useWorkspaceCharts();
	const [selectedAspectId, setSelectedAspectId] = useState<string | null>(null);

	const positions = (selectedChart?.computed?.positions ?? {}) as Record<string, unknown>;
	const motion = selectedChart?.computed?.motion ?? {};
	const bodyOrder = useMemo(
		() =>
			workspaceDefaults.defaultBodies.length > 0
				? workspaceDefaults.defaultBodies
				: DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS,
		[workspaceDefaults.defaultBodies]
	);
	const enabledBodySet = useMemo(() => new Set(bodyOrder), [bodyOrder]);
	const enabledAspectSet = useMemo(
		() =>
			new Set(
				workspaceDefaults.defaultAspects.length > 0
					? workspaceDefaults.defaultAspects
					: ASPECT_ROWS.map((aspect) => aspect.id)
			),
		[workspaceDefaults.defaultAspects]
	);
	const bodyOrderIndex = useMemo(
		() => new Map(bodyOrder.map((id, index) => [id, index] as const)),
		[bodyOrder]
	);

	const visibleAspects = useMemo(() => {
		return (selectedChart?.computed?.aspects ?? [])
			.map(parseAspect)
			.filter((aspect): aspect is ParsedAspect => aspect !== null)
			.filter(
				(aspect) =>
					enabledAspectSet.has(aspect.type) &&
					enabledBodySet.has(aspect.from) &&
					enabledBodySet.has(aspect.to)
			);
	}, [enabledAspectSet, enabledBodySet, selectedChart?.computed?.aspects]);

	const aspectMap = useMemo(() => {
		const next = new Map<string, ParsedAspect>();
		for (const aspect of visibleAspects) {
			next.set(canonicalPairKey(aspect.from, aspect.to, bodyOrderIndex), aspect);
		}
		return next;
	}, [bodyOrderIndex, visibleAspects]);

	const aspectEntries = useMemo(
		() =>
			visibleAspects.map((aspect) => ({
				id: aspectIdentity(aspect, bodyOrderIndex),
				aspect
			})),
		[bodyOrderIndex, visibleAspects]
	);

	const selectedAspect =
		aspectEntries.find((entry) => entry.id === selectedAspectId)?.aspect ?? null;

	useEffect(() => {
		if (selectedAspectId && !aspectEntries.some((entry) => entry.id === selectedAspectId)) {
			setSelectedAspectId(null);
		}
	}, [aspectEntries, selectedAspectId]);

	const panelSurface =
		theme === 'midnight' || theme === 'twilight' ? 'bg-white/5' : 'bg-[color:var(--theme-panel-bg)]';

	const renderMatrix = () => (
		<Card variant="themed" theme={theme} className="flex h-full min-h-0 gap-0 overflow-hidden">
			<CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
				<div className="shrink-0 space-y-1">
					<h1 className={cn('text-2xl font-semibold', ft.title)}>{t('aspects_aspects')}</h1>
					<p className={cn('text-sm', ft.muted)}>{t('aspectarium_subtitle')}</p>
				</div>

				<div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-[color:var(--theme-panel-bg)]/80 p-2 md:p-3">
					<table className="border-separate border-spacing-2">
						<tbody>
							{bodyOrder.map((rowId, rowIndex) => (
								<tr key={rowId}>
									<td className="sticky left-0 z-10 pr-2 align-middle">
										<div
											className={cn(
												'flex min-w-40 items-center gap-3 rounded-xl px-3 py-2 backdrop-blur-sm',
												panelSurface
											)}
										>
											<BodyGlyph
												bodyId={rowId}
												glyphSet={glyphSet}
												size={22}
												className="text-[color:var(--theme-content-primary)]"
											/>
											<div className="min-w-0">
												<p className={cn('truncate text-sm font-medium', ft.title)}>
													{bodyLabel(rowId, t)}
												</p>
												<p className={cn('truncate text-xs', ft.muted)}>
													{formatPosition(normalizeLongitude(positions[rowId])) ??
														t('loading_positions')}
												</p>
											</div>
										</div>
									</td>

									{bodyOrder.map((colId, colIndex) => {
										if (colIndex > rowIndex) {
											return <td key={`${rowId}:${colId}`} className="h-16 w-16 min-w-16" />;
										}

										if (colIndex === rowIndex) {
											return (
												<td key={`${rowId}:${colId}`} className="h-16 w-16 min-w-16">
													<div
														className={cn(
															'flex aspect-square items-center justify-center rounded-xl text-[color:var(--theme-content-muted)]',
															panelSurface
														)}
													>
														<BodyGlyph
															bodyId={rowId}
															glyphSet={glyphSet}
															size={22}
															className="opacity-80"
														/>
													</div>
												</td>
											);
										}

										const pairKey = canonicalPairKey(rowId, colId, bodyOrderIndex);
										const aspect = aspectMap.get(pairKey);
										if (!aspect) {
											return (
												<td key={`${rowId}:${colId}`} className="h-16 w-16 min-w-16">
													<div
														className={cn(
															'flex aspect-square items-center justify-center rounded-xl text-xs text-[color:var(--theme-content-muted)] opacity-40',
															panelSurface
														)}
													>
														•
													</div>
												</td>
											);
										}

										const aspectId = aspectIdentity(aspect, bodyOrderIndex);
										const aspectColor =
											workspaceDefaults.defaultAspectColors[aspect.type] ??
											DEFAULT_ASPECT_COLORS[
												aspect.type as keyof typeof DEFAULT_ASPECT_COLORS
											] ??
											'var(--theme-accent)';

										return (
											<td key={`${rowId}:${colId}`} className="h-16 w-16 min-w-16">
												<AspectCellButton
													aspect={aspect}
													isSelected={selectedAspectId === aspectId}
													onSelect={() => setSelectedAspectId(aspectId)}
													color={aspectColor}
												/>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className={cn('shrink-0 text-xs', ft.muted)}>
					{visibleAspects.length > 0
						? t('aspectarium_select_aspect_hint')
						: t('aspectarium_no_aspects')}
				</div>
			</CardContent>
		</Card>
	);

	const renderDetailContent = () =>
		selectedAspect ? (
			<ScrollArea className="min-h-0 h-full pr-3">
				<div className="space-y-5 rounded-2xl bg-[color:var(--theme-soft-bg)]/45 p-4">
					<div>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2">
								<BodyGlyph
									bodyId={selectedAspect.from}
									glyphSet={glyphSet}
									size={18}
									className="text-[color:var(--theme-content-primary)]"
								/>
								<span className={cn('text-sm font-medium', ft.title)}>
									{bodyLabel(selectedAspect.from, t)}
								</span>
							</div>
							<span
								className="text-xl leading-none"
								style={{
									color:
										workspaceDefaults.defaultAspectColors[selectedAspect.type] ??
										DEFAULT_ASPECT_COLORS[
											selectedAspect.type as keyof typeof DEFAULT_ASPECT_COLORS
										] ??
										'var(--theme-accent)'
								}}
							>
								{ASPECT_GLYPHS[selectedAspect.type] ?? '•'}
							</span>
							<div className="flex items-center gap-2">
								<BodyGlyph
									bodyId={selectedAspect.to}
									glyphSet={glyphSet}
									size={18}
									className="text-[color:var(--theme-content-primary)]"
								/>
								<span className={cn('text-sm font-medium', ft.title)}>
									{bodyLabel(selectedAspect.to, t)}
								</span>
							</div>
						</div>
					</div>
					<Separator className="bg-[color:var(--theme-panel-border)]" />

					<div className="space-y-3">
						<p className={cn('text-sm font-medium', ft.title)}>{t('details')}</p>
						<DetailRow
							label={t('transits_label_type')}
							value={
								ASPECT_LABEL_KEY_MAP.get(selectedAspect.type)
									? t(ASPECT_LABEL_KEY_MAP.get(selectedAspect.type)!)
									: fallbackAspectLabel(selectedAspect.type)
							}
						/>
						<DetailRow label={t('label_orb')} value={formatOrb(selectedAspect.orb)} />
						<DetailRow
							label={t('aspectarium_angle')}
							value={formatDegrees(selectedAspect.angle, 2)}
						/>
						<DetailRow
							label={t('aspectarium_exact_angle')}
							value={formatDegrees(selectedAspect.exactAngle, 2)}
						/>
						<DetailRow
							label={t('aspectarium_applying')}
							value={selectedAspect.applying ? t('selected') : null}
						/>
						<DetailRow
							label={t('aspectarium_separating')}
							value={selectedAspect.separating ? t('selected') : null}
						/>
					</div>
					<Separator className="bg-[color:var(--theme-panel-border)]" />

					{[selectedAspect.from, selectedAspect.to].map((bodyId, index) => {
						const longitude = normalizeLongitude(positions[bodyId]);
						const motionInfo = motion[bodyId];
						return (
							<div key={`${selectedAspectId}:${bodyId}`} className="space-y-3">
								<div className="flex items-center gap-3">
									<BodyGlyph
										bodyId={bodyId}
										glyphSet={glyphSet}
										size={18}
										className="text-[color:var(--theme-content-primary)]"
									/>
									<p className={cn('text-sm font-medium', ft.title)}>
										{index === 0 ? t('aspectarium_body_a') : t('aspectarium_body_b')}
									</p>
								</div>
								<DetailRow label={t('charts')} value={bodyLabel(bodyId, t)} />
								<DetailRow label={t('aspectarium_position')} value={formatPosition(longitude)} />
								<DetailRow
									label={t('aspectarium_absolute_longitude')}
									value={longitude === null ? null : formatDegrees(longitude, 2)}
								/>
								<DetailRow
									label={t('open_filter_motion')}
									value={motionInfo ? (motionInfo.retrograde ? 'R' : 'D') : null}
								/>
							</div>
						);
					})}
				</div>
			</ScrollArea>
		) : null;

	return (
		<>
			<div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">{renderMatrix()}</div>

			<DetailSidePanel
				theme={theme}
				open={selectedAspect !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedAspectId(null);
				}}
				title={t('details')}
				description={t('aspectarium_reported_aspects')}
			>
				{renderDetailContent()}
			</DetailSidePanel>
		</>
	);
}
