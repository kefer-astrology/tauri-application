import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableRow } from './ui/table';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { Theme } from './astrology-sidebar';
import { DetailSidePanel } from './detail-side-panel';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import {
	DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS,
	OBSERVABLE_OBJECTS,
	getObservableObjectLabel
} from '@/lib/astrology/observableObjects';
import { ASPECT_GLYPHS, ASPECT_ROWS, DEFAULT_ASPECT_COLORS } from '@/lib/astrology/aspects';
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

type AspectLayer = 'radix' | 'transit';

interface AspectEntry {
	id: string;
	aspect: ParsedAspect;
	fromLayer: AspectLayer;
	toLayer: AspectLayer;
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

const OBSERVABLE_OBJECT_MAP = new Map(OBSERVABLE_OBJECTS.map((item) => [item.id, item] as const));
const OBSERVABLE_OBJECT_ICON_MAP = new Map(
	OBSERVABLE_OBJECTS.map((item) => [item.id, item.icon] as const)
);
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
		typeof orbRaw === 'number' ? orbRaw : typeof orbRaw === 'string' ? Number(orbRaw) : NaN;
	if (!Number.isFinite(orb)) return null;
	return {
		from,
		to,
		type,
		orb,
		angle: typeof angleRaw === 'number' && Number.isFinite(angleRaw) ? angleRaw : undefined,
		exactAngle:
			typeof exactAngleRaw === 'number' && Number.isFinite(exactAngleRaw)
				? exactAngleRaw
				: undefined,
		applying: aspect.applying === true,
		separating: aspect.separating === true
	};
}

function bodyLabel(id: string, t: (key: string, options?: Record<string, unknown>) => string) {
	const item = OBSERVABLE_OBJECT_MAP.get(id);
	if (!item) return id;
	return getObservableObjectLabel(item, t);
}

function bodyIcon(id: string) {
	return OBSERVABLE_OBJECT_ICON_MAP.get(id) ?? id.slice(0, 3);
}

function canonicalPairKey(idA: string, idB: string, orderIndex: Map<string, number>) {
	const idxA = orderIndex.get(idA) ?? Number.MAX_SAFE_INTEGER;
	const idxB = orderIndex.get(idB) ?? Number.MAX_SAFE_INTEGER;
	return idxA <= idxB ? `${idA}::${idB}` : `${idB}::${idA}`;
}

function directionalPairKey(from: string, to: string) {
	return `${from}::${to}`;
}

function aspectIdentity(aspect: ParsedAspect, orderIndex: Map<string, number>, layer: AspectLayer) {
	return layer === 'transit'
		? `transit::${directionalPairKey(aspect.from, aspect.to)}::${aspect.type}`
		: `radix::${canonicalPairKey(aspect.from, aspect.to, orderIndex)}::${aspect.type}`;
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
				'flex aspect-square min-h-14 w-full min-w-14 flex-col items-center justify-center rounded-lg px-1.5 py-1 transition-colors',
				isSelected
					? 'bg-[color:var(--theme-soft-bg)] ring-1 ring-[color:var(--theme-accent)]'
					: 'bg-[color:var(--theme-panel-bg)]/72 hover:bg-[color:var(--theme-soft-bg)]'
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

function DetailRow({ label, value }: { label: string; value: string | null }) {
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
	const { selectedChart, transitOverlay } = useWorkspaceCharts();
	const [selectedAspectId, setSelectedAspectId] = useState<string | null>(null);

	const positions = (selectedChart?.computed?.positions ?? {}) as Record<string, unknown>;
	const motion = selectedChart?.computed?.motion ?? {};
	const activeTransitOverlay =
		transitOverlay && transitOverlay.sourceChartId === selectedChart?.id ? transitOverlay : null;
	const transitPositions = (activeTransitOverlay?.transitChart.computed?.positions ?? {}) as Record<
		string,
		unknown
	>;
	const transitMotion = activeTransitOverlay?.transitChart.computed?.motion ?? {};
	const configuredBodyOrder = useMemo(
		() =>
			workspaceDefaults.defaultBodies.length > 0
				? workspaceDefaults.defaultBodies
				: DEFAULT_ENABLED_OBSERVABLE_OBJECT_IDS,
		[workspaceDefaults.defaultBodies]
	);
	const bodyOrder = useMemo(
		() =>
			(activeTransitOverlay?.transitedBodies ?? configuredBodyOrder).filter((id) => {
				const value = positions[id];
				return normalizeLongitude(value) !== null;
			}),
		[activeTransitOverlay?.transitedBodies, configuredBodyOrder, positions]
	);
	const transitBodyOrder = useMemo(
		() =>
			(activeTransitOverlay?.transitingBodies ?? []).filter((id) => {
				const value = transitPositions[id];
				return normalizeLongitude(value) !== null;
			}),
		[activeTransitOverlay?.transitingBodies, transitPositions]
	);
	const rowBodyOrder = activeTransitOverlay ? transitBodyOrder : bodyOrder;
	const columnBodyOrder = bodyOrder;
	const enabledBodySet = useMemo(() => new Set(bodyOrder), [bodyOrder]);
	const enabledTransitBodySet = useMemo(() => new Set(transitBodyOrder), [transitBodyOrder]);
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

	const visibleRadixAspects = useMemo(() => {
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

	const visibleTransitAspects = useMemo(() => {
		return (activeTransitOverlay?.aspects ?? [])
			.map(parseAspect)
			.filter((aspect): aspect is ParsedAspect => aspect !== null)
			.filter(
				(aspect) =>
					enabledAspectSet.has(aspect.type) &&
					enabledTransitBodySet.has(aspect.from) &&
					enabledBodySet.has(aspect.to)
			);
	}, [activeTransitOverlay?.aspects, enabledAspectSet, enabledBodySet, enabledTransitBodySet]);

	const visibleAspects = activeTransitOverlay ? visibleTransitAspects : visibleRadixAspects;

	const aspectMap = useMemo(() => {
		const next = new Map<string, AspectEntry>();
		if (activeTransitOverlay) {
			for (const aspect of visibleTransitAspects) {
				next.set(directionalPairKey(aspect.from, aspect.to), {
					id: aspectIdentity(aspect, bodyOrderIndex, 'transit'),
					aspect,
					fromLayer: 'transit',
					toLayer: 'radix'
				});
			}
		} else {
			for (const aspect of visibleRadixAspects) {
				next.set(canonicalPairKey(aspect.from, aspect.to, bodyOrderIndex), {
					id: aspectIdentity(aspect, bodyOrderIndex, 'radix'),
					aspect,
					fromLayer: 'radix',
					toLayer: 'radix'
				});
			}
		}
		return next;
	}, [activeTransitOverlay, bodyOrderIndex, visibleRadixAspects, visibleTransitAspects]);

	const aspectEntries = useMemo(() => Array.from(aspectMap.values()), [aspectMap]);

	const selectedAspectEntry = aspectEntries.find((entry) => entry.id === selectedAspectId) ?? null;
	const selectedAspect = selectedAspectEntry?.aspect ?? null;

	useEffect(() => {
		if (selectedAspectId && !aspectEntries.some((entry) => entry.id === selectedAspectId)) {
			setSelectedAspectId(null);
		}
	}, [aspectEntries, selectedAspectId]);

	const panelSurface =
		theme === 'midnight' || theme === 'twilight'
			? 'bg-[color:var(--token-surface-subtle)]/35'
			: 'bg-[color:var(--theme-panel-bg)]/82';

	const positionsForLayer = (layer: AspectLayer) =>
		layer === 'transit' ? transitPositions : positions;

	const renderBodyLabel = (bodyId: string, layer: AspectLayer, compact = false) => (
		<div
			className={cn(
				'flex items-center gap-3 rounded-lg backdrop-blur-sm',
				compact ? 'min-w-20 flex-col gap-1 px-2 py-2 text-center' : 'min-w-36 px-3 py-2',
				panelSurface
			)}
		>
			<BodyGlyph
				bodyId={bodyId}
				glyphSet={glyphSet}
				size={compact ? 18 : 22}
				className="text-[color:var(--theme-content-primary)]"
			/>
			<div className="min-w-0">
				<p className={cn('truncate text-sm font-medium', ft.title)}>{bodyLabel(bodyId, t)}</p>
				<p className={cn('truncate text-xs', ft.muted)}>
					{formatPosition(normalizeLongitude(positionsForLayer(layer)[bodyId])) ??
						t('loading_positions')}
				</p>
			</div>
		</div>
	);

	const renderMatrix = () => (
		<Card
			variant="themed"
			theme={theme}
			className="flex h-full min-h-0 gap-0 overflow-hidden border-0 shadow-none ring-0"
		>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-5">
				<div className="shrink-0 space-y-1">
					<h1 className={cn('text-2xl font-semibold', ft.title)}>{t('aspects_aspects')}</h1>
					<p className={cn('text-sm', ft.muted)}>{t('aspectarium_subtitle')}</p>
				</div>

				<div
					dir="rtl"
					className="min-h-0 flex-1 overflow-auto rounded-2xl bg-[color:var(--theme-panel-bg)]/74 pt-2 pr-2 pb-2 pl-0 md:pt-2.5 md:pr-2.5 md:pb-2.5 md:pl-0"
				>
					<div dir="ltr" className="mr-auto w-max">
						<Table className="w-auto border-separate border-spacing-1.5 md:border-spacing-1">
							<TableBody>
								{activeTransitOverlay ? (
									<TableRow className="border-0 hover:bg-transparent">
										<TableCell className="sticky left-0 z-20 p-0 pr-1.5 align-middle">
											<div
												className={cn(
													'flex min-w-36 items-center rounded-lg px-3 py-2 text-xs font-semibold backdrop-blur-sm',
													panelSurface,
													ft.muted
												)}
											>
												{t('transit_overlay_aspectarium_hint')}
											</div>
										</TableCell>
										{columnBodyOrder.map((colId) => (
											<TableCell key={`head:${colId}`} className="p-0 align-bottom">
												{renderBodyLabel(colId, 'radix', true)}
											</TableCell>
										))}
									</TableRow>
								) : null}
								{rowBodyOrder.map((rowId, rowIndex) => (
									<TableRow key={rowId} className="border-0 hover:bg-transparent">
										<TableCell className="sticky left-0 z-10 p-0 pr-1.5 align-middle">
											{renderBodyLabel(rowId, activeTransitOverlay ? 'transit' : 'radix')}
										</TableCell>

										{columnBodyOrder.map((colId, colIndex) => {
											if (!activeTransitOverlay && colIndex > rowIndex) {
												return (
													<TableCell key={`${rowId}:${colId}`} className="h-14 w-14 min-w-14 p-0" />
												);
											}

											if (!activeTransitOverlay && colIndex === rowIndex) {
												return (
													<TableCell key={`${rowId}:${colId}`} className="h-14 w-14 min-w-14 p-0">
														<div
															className={cn(
																'flex aspect-square items-center justify-center rounded-lg text-[color:var(--theme-content-muted)]',
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
													</TableCell>
												);
											}

											const pairKey = activeTransitOverlay
												? directionalPairKey(rowId, colId)
												: canonicalPairKey(rowId, colId, bodyOrderIndex);
											const entry = aspectMap.get(pairKey);
											if (!entry) {
												return (
													<TableCell key={`${rowId}:${colId}`} className="h-14 w-14 min-w-14 p-0">
														<div
															className={cn(
																'flex aspect-square items-center justify-center rounded-lg text-[11px] text-[color:var(--theme-content-muted)] opacity-34',
																panelSurface
															)}
														>
															•
														</div>
													</TableCell>
												);
											}

											const { aspect } = entry;
											const aspectColor =
												workspaceDefaults.defaultAspectColors[aspect.type] ??
												DEFAULT_ASPECT_COLORS[aspect.type as keyof typeof DEFAULT_ASPECT_COLORS] ??
												'var(--theme-accent)';

											return (
												<TableCell key={`${rowId}:${colId}`} className="h-14 w-14 min-w-14 p-0">
													<AspectCellButton
														aspect={aspect}
														isSelected={selectedAspectId === entry.id}
														onSelect={() => setSelectedAspectId(entry.id)}
														color={aspectColor}
													/>
												</TableCell>
											);
										})}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>

				<div className={cn('shrink-0 text-xs', ft.muted)}>
					{visibleAspects.length > 0
						? t('aspectarium_select_aspect_hint')
						: activeTransitOverlay
							? t('transit_overlay_no_aspects')
							: t('aspectarium_no_aspects')}
				</div>
			</CardContent>
		</Card>
	);

	const renderDetailContent = () =>
		selectedAspect && selectedAspectEntry ? (
			<div className="h-full min-h-0 overflow-y-auto rounded-2xl bg-[color:var(--theme-soft-bg)]/42 pr-2">
				<div className="space-y-5 p-4">
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

					{[
						{
							bodyId: selectedAspect.from,
							layer: selectedAspectEntry.fromLayer,
							label: t('aspectarium_body_a')
						},
						{
							bodyId: selectedAspect.to,
							layer: selectedAspectEntry.toLayer,
							label: t('aspectarium_body_b')
						}
					].map(({ bodyId, layer, label }) => {
						const sourcePositions = layer === 'transit' ? transitPositions : positions;
						const sourceMotion = layer === 'transit' ? transitMotion : motion;
						const longitude = normalizeLongitude(sourcePositions[bodyId]);
						const motionInfo = sourceMotion[bodyId];
						const layerLabel =
							layer === 'transit'
								? t('transits_general_transit_transit')
								: (selectedChart?.name ?? 'Radix');
						return (
							<div key={`${selectedAspectId}:${layer}:${bodyId}`} className="space-y-3">
								<div className="flex items-center gap-3">
									<BodyGlyph
										bodyId={bodyId}
										glyphSet={glyphSet}
										size={18}
										className="text-[color:var(--theme-content-primary)]"
									/>
									<p className={cn('text-sm font-medium', ft.title)}>{label}</p>
								</div>
								<DetailRow label={t('charts')} value={`${bodyLabel(bodyId, t)} · ${layerLabel}`} />
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
			</div>
		) : null;

	return (
		<>
			<div className="flex h-full min-h-0 flex-col p-4 md:p-6">{renderMatrix()}</div>

			<DetailSidePanel
				theme={theme}
				open={selectedAspect !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedAspectId(null);
				}}
				title={t('details')}
				description={
					activeTransitOverlay
						? t('transit_overlay_aspectarium_hint')
						: t('aspectarium_reported_aspects')
				}
			>
				{renderDetailContent()}
			</DetailSidePanel>
		</>
	);
}
