import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	computeChartFromData,
	computeCrossAspectsFromData,
	computeTransitSeries
} from '@/lib/tauri/workspace';
import type { TransitSeriesEntry } from '@/lib/tauri/types';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import type { TransitSection } from './transits-secondary-sidebar';
import { AspectSelector } from './aspect-selector';
import { BodySelector } from './body-selector';
import { ASPECT_ROWS } from '@/lib/astrology/aspects';
import type { Theme } from './astrology-sidebar';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import {
	chartDataToComputePayload,
	normalizeComputedChartPayload,
	type AppChart,
	type WorkspaceDefaultsState
} from '@/lib/tauri/chartPayload';
import { normalizeLongitude } from '@/lib/astrology/transits';

interface TransitsContentProps {
	section: TransitSection;
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	workspacePath: string | null;
	workspaceDefaults: WorkspaceDefaultsState;
}

type DropdownOption = { id: string; label: string };

const DEFAULT_TRANSIT_BODY_IDS = [
	'sun',
	'moon',
	'mercury',
	'venus',
	'mars',
	'jupiter',
	'saturn',
	'uranus',
	'neptune',
	'pluto'
];

const DEFAULT_TRANSIT_ASPECT_IDS = ASPECT_ROWS.filter((row) => row.type === 'major').map(
	(row) => row.id
);

function formatDateInput(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date): string {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
}

function buildLocalIso(dateValue: string, timeValue: string): string {
	const date = new Date(`${dateValue}T${timeValue || '00:00'}:00`);
	if (Number.isNaN(date.getTime())) {
		throw new Error('Invalid transit date or time.');
	}
	return date.toISOString();
}

function positionsForIds(
	positions: Record<string, unknown>,
	ids: readonly string[]
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const id of new Set(ids)) {
		const longitude = normalizeLongitude(positions[id]);
		if (longitude !== null) result[id] = longitude;
	}
	return result;
}

export function TransitsContent({
	section,
	theme,
	glyphSet,
	workspacePath,
	workspaceDefaults
}: TransitsContentProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const {
		charts,
		selectedChartId,
		setCharts,
		setSelectedChartId,
		setTransitOverlay,
		clearTransitOverlay
	} = useWorkspaceCharts();

	const [selectedTypeId, setSelectedTypeId] = useState('transit');
	const [periodModeId, setPeriodModeId] = useState('current');
	const [checkboxes, setCheckboxes] = useState({
		houseTransitions: false,
		signTransitions: false,
		transitLimits: false,
		precessionCorrection: false
	});
	const now = useMemo(() => new Date(), []);
	const tomorrow = useMemo(() => {
		const date = new Date(now);
		date.setDate(date.getDate() + 1);
		return date;
	}, [now]);
	const [sourceChartId, setSourceChartId] = useState('');
	const [fromDate, setFromDate] = useState(formatDateInput(now));
	const [fromTime, setFromTime] = useState(formatTimeInput(now));
	const [toDate, setToDate] = useState(formatDateInput(tomorrow));
	const [toTime, setToTime] = useState(formatTimeInput(now));
	const [transitingBodies, setTransitingBodies] = useState<string[]>(DEFAULT_TRANSIT_BODY_IDS);
	const [transitedBodies, setTransitedBodies] = useState<string[]>(DEFAULT_TRANSIT_BODY_IDS);
	const [selectedAspects, setSelectedAspects] = useState<string[]>(DEFAULT_TRANSIT_ASPECT_IDS);
	const [transitLoading, setTransitLoading] = useState(false);
	const [transitError, setTransitError] = useState<string | null>(null);
	const [transitSeries, setTransitSeries] = useState<TransitSeriesEntry[]>([]);

	const effectiveSourceChartId = sourceChartId || selectedChartId || charts[0]?.id || '';

	useEffect(() => {
		if (sourceChartId || charts.length === 0) return;
		setSourceChartId(selectedChartId ?? charts[0].id);
	}, [charts, selectedChartId, sourceChartId]);

	const transitResultsCountLabel = useMemo(
		() => t('transit_results_count').replace('{count}', String(transitSeries.length)),
		[t, transitSeries.length]
	);

	const ensureChartComputed = async (
		chart: AppChart
	): Promise<NonNullable<AppChart['computed']>> => {
		if (Object.keys(chart.computed?.positions ?? {}).length > 0) {
			return chart.computed!;
		}
		const result = await computeChartFromData(chartDataToComputePayload(chart, workspaceDefaults));
		const computed = normalizeComputedChartPayload(result);
		setCharts((prev) =>
			prev.map((existing) => (existing.id === chart.id ? { ...existing, computed } : existing))
		);
		return computed;
	};

	const handleComputeTransits = async () => {
		if (!effectiveSourceChartId) {
			setTransitError('No chart selected for transit computation.');
			return;
		}
		const sourceChart = charts.find((chart) => chart.id === effectiveSourceChartId);
		if (!sourceChart) {
			setTransitError('Selected chart was not found.');
			return;
		}
		if (selectedAspects.length === 0) {
			setTransitError('Select at least one aspect for transit computation.');
			return;
		}

		let range: { startDatetime: string; endDatetime: string };
		try {
			range =
				periodModeId === 'current'
					? (() => {
							const instant = new Date().toISOString();
							return { startDatetime: instant, endDatetime: instant };
						})()
					: {
							startDatetime: buildLocalIso(fromDate, fromTime),
							endDatetime: buildLocalIso(toDate, toTime)
						};
		} catch (err) {
			setTransitError(err instanceof Error ? err.message : 'Invalid transit date or time.');
			return;
		}

		setTransitLoading(true);
		setTransitError(null);
		setTransitSeries([]);

		try {
			const radixComputed = await ensureChartComputed(sourceChart);
			const transitDateTime = range.endDatetime;
			const transitChart: AppChart = {
				...sourceChart,
				id: `${sourceChart.id}__transit__${transitDateTime.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
				name: `${sourceChart.name} ${t('transits_general_transit_transit')}`,
				chartType: 'EVENT',
				dateTime: transitDateTime,
				observableObjects:
					transitingBodies.length > 0 ? transitingBodies : DEFAULT_TRANSIT_BODY_IDS,
				tags: [...(sourceChart.tags ?? []), 'transit']
			};
			const transitResult = await computeChartFromData(
				chartDataToComputePayload(transitChart, workspaceDefaults)
			);
			const transitComputed = normalizeComputedChartPayload(transitResult);
			const computedTransitChart = { ...transitChart, computed: transitComputed };
			const effectiveTransitedBodies =
				transitedBodies.length > 0
					? transitedBodies
					: (sourceChart.observableObjects ?? workspaceDefaults.defaultBodies);
			const crossAspects = await computeCrossAspectsFromData(
				chartDataToComputePayload(sourceChart, workspaceDefaults),
				positionsForIds(transitComputed.positions ?? {}, transitingBodies),
				positionsForIds(radixComputed.positions ?? {}, effectiveTransitedBodies),
				selectedAspects
			);
			const overlay = {
				sourceChartId: sourceChart.id,
				sourceChartName: sourceChart.name,
				dateTime: transitDateTime,
				transitChart: computedTransitChart,
				transitingBodies,
				transitedBodies: effectiveTransitedBodies,
				aspectTypes: selectedAspects,
				aspects: crossAspects
			};
			setTransitOverlay(overlay);
			setSelectedChartId(sourceChart.id);

			const singleEntry: TransitSeriesEntry = {
				datetime: transitDateTime,
				transit_positions: transitComputed.positions,
				aspects: crossAspects
			};

			if (!workspacePath) {
				setTransitSeries([singleEntry]);
				return;
			}

			try {
				const result = await computeTransitSeries({
					workspacePath,
					chartId: effectiveSourceChartId,
					startDatetime: range.startDatetime,
					endDatetime: range.endDatetime,
					timeStepSeconds: 3600,
					transitingObjects: transitingBodies,
					transitedObjects: effectiveTransitedBodies,
					aspectTypes: selectedAspects
				});

				setTransitSeries(result.results ?? [singleEntry]);
			} catch (seriesErr) {
				console.error('Failed to compute transit series:', seriesErr);
				setTransitSeries([singleEntry]);
				setTransitError(
					seriesErr instanceof Error
						? seriesErr.message
						: 'Transit series failed; showing the end timestamp overlay.'
				);
			}
		} catch (err) {
			console.error('Failed to compute transits:', err);
			setTransitError(err instanceof Error ? err.message : 'Transit computation failed.');
		} finally {
			setTransitLoading(false);
		}
	};

	const typeOptions = useMemo<DropdownOption[]>(
		() => [
			{ id: 'transit', label: t('transits_general_transit_transit') },
			{ id: 'primary', label: t('transits_general_transit_primary') },
			{ id: 'secondary', label: t('transits_general_transit_secondary') }
		],
		[t]
	);

	const periodOptions = useMemo<DropdownOption[]>(
		() => [
			{ id: 'current', label: t('transits_period_current') },
			{ id: 'custom', label: t('transits_period_custom') }
		],
		[t]
	);

	const isPeriodDisabled = periodModeId === 'current';
	const areCheckboxesDisabled = true;
	const areTimezoneInputsDisabled = true;

	const renderContent = () => {
		switch (section) {
			case 'general':
				return (
					<Card variant="ghost" className="w-full rounded-xl">
						<CardContent className="flex flex-col space-y-6 p-6 md:p-8">
							<p className={cn('text-sm', ft.muted)}>{t('transits_subtitle_general')}</p>

							<div>
								<Label className={cn('mb-2 block', ft.label)}>{t('transits_label_type')}</Label>
								<Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
									<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className={ft.selectContent}>
										{typeOptions.map((option) => (
											<SelectItem
												key={option.id}
												value={option.id}
												className={ft.selectItem}
												disabled={option.id !== 'transit'}
											>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div data-tour="transits-period">
								<Label className={cn('mb-2 block', ft.label)}>{t('transits_label_period')}</Label>
								<Select value={periodModeId} onValueChange={setPeriodModeId}>
									<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className={ft.selectContent}>
										{periodOptions.map((option) => (
											<SelectItem key={option.id} value={option.id} className={ft.selectItem}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<Label className={cn('mb-2 block', ft.label)}>{t('sidebar_horoscope')}</Label>
								<Select
									value={effectiveSourceChartId || '__none'}
									onValueChange={(value) => {
										if (value !== '__none') setSourceChartId(value);
									}}
								>
									<SelectTrigger className={cn(ft.selectTrigger, 'shadow-inner')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className={ft.selectContent}>
										{charts.length === 0 ? (
											<SelectItem value="__none" className={ft.selectItem} disabled>
												{t('open_table_empty')}
											</SelectItem>
										) : (
											charts.map((chart) => (
												<SelectItem key={chart.id} value={chart.id} className={ft.selectItem}>
													{chart.name}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-3">
									<Label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<Checkbox
											checked={checkboxes.houseTransitions}
											onCheckedChange={(checked) =>
												setCheckboxes({ ...checkboxes, houseTransitions: checked === true })
											}
											className={cn('mt-0.5 disabled:cursor-not-allowed', ft.checkboxAccent)}
											disabled={areCheckboxesDisabled}
										/>
										<span
											className={cn(
												'text-sm',
												areCheckboxesDisabled ? ft.textDisabled : ft.bodyText
											)}
										>
											{t('transits_general_crossings')}
										</span>
									</Label>
									<Label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<Checkbox
											checked={checkboxes.signTransitions}
											onCheckedChange={(checked) =>
												setCheckboxes({ ...checkboxes, signTransitions: checked === true })
											}
											className={cn('mt-0.5 disabled:cursor-not-allowed', ft.checkboxAccent)}
											disabled={areCheckboxesDisabled}
										/>
										<span
											className={cn(
												'text-sm',
												areCheckboxesDisabled ? ft.textDisabled : ft.bodyText
											)}
										>
											{t('transits_general_crossings_2')}
										</span>
									</Label>
								</div>
								<div className="space-y-3">
									<Label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<Checkbox
											checked={checkboxes.transitLimits}
											onCheckedChange={(checked) =>
												setCheckboxes({ ...checkboxes, transitLimits: checked === true })
											}
											className={cn('mt-0.5 disabled:cursor-not-allowed', ft.checkboxAccent)}
											disabled={areCheckboxesDisabled}
										/>
										<span
											className={cn(
												'text-sm',
												areCheckboxesDisabled ? ft.textDisabled : ft.bodyText
											)}
										>
											{t('transits_general_transit_2')}
										</span>
									</Label>
									<Label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<Checkbox
											checked={checkboxes.precessionCorrection}
											onCheckedChange={(checked) =>
												setCheckboxes({
													...checkboxes,
													precessionCorrection: checked === true
												})
											}
											className={cn('mt-0.5 disabled:cursor-not-allowed', ft.checkboxAccent)}
											disabled={areCheckboxesDisabled}
										/>
										<span
											className={cn(
												'text-sm',
												areCheckboxesDisabled ? ft.textDisabled : ft.bodyText
											)}
										>
											{t('transits_general_precession')}
										</span>
									</Label>
								</div>
							</div>

							<div>
								<Label className={cn('mb-2 block', ft.label)}>{t('transits_period_from')}:</Label>
								<div className="grid grid-cols-3 gap-3">
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_date')}
										</Label>
										<Input
											type="date"
											value={fromDate}
											onChange={(event) => setFromDate(event.currentTarget.value)}
											disabled={isPeriodDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												isPeriodDisabled && ft.inputDisabled
											)}
										/>
									</div>
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_time')}
										</Label>
										<Input
											type="time"
											value={fromTime}
											onChange={(event) => setFromTime(event.currentTarget.value)}
											disabled={isPeriodDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												isPeriodDisabled && ft.inputDisabled
											)}
										/>
									</div>
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_timezone')}
										</Label>
										<Input
											type="text"
											placeholder={t('transits_timezone_placeholder')}
											disabled={areTimezoneInputsDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												areTimezoneInputsDisabled && ft.inputDisabled
											)}
										/>
									</div>
								</div>
							</div>

							<div>
								<Label className={cn('mb-2 block', ft.label)}>{t('transits_period_to')}:</Label>
								<div className="grid grid-cols-3 gap-3">
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_date')}
										</Label>
										<Input
											type="date"
											value={toDate}
											onChange={(event) => setToDate(event.currentTarget.value)}
											disabled={isPeriodDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												isPeriodDisabled && ft.inputDisabled
											)}
										/>
									</div>
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_time')}
										</Label>
										<Input
											type="time"
											value={toTime}
											onChange={(event) => setToTime(event.currentTarget.value)}
											disabled={isPeriodDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												isPeriodDisabled && ft.inputDisabled
											)}
										/>
									</div>
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_timezone')}
										</Label>
										<Input
											type="text"
											placeholder={t('transits_timezone_placeholder')}
											disabled={areTimezoneInputsDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												areTimezoneInputsDisabled && ft.inputDisabled
											)}
										/>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-center gap-4 pt-6">
								<Button
									type="button"
									variant="outline"
									className={cn(ft.footerCancel, '!flex-none')}
									onClick={() => {
										setTransitError(null);
										setTransitSeries([]);
										clearTransitOverlay();
									}}
								>
									{t('button_close')}
								</Button>
								<Button
									data-tour="transits-calculate"
									type="button"
									className={cn(ft.footerPrimary, '!flex-none')}
									onClick={() => void handleComputeTransits()}
									disabled={transitLoading}
								>
									{t('calculate')}
								</Button>
							</div>
						</CardContent>
					</Card>
				);

			case 'transiting-bodies':
				return (
					<BodySelector
						theme={theme}
						glyphSet={glyphSet}
						subtitleKey="transits_subtitle_transiting"
						selectedBodyIds={transitingBodies}
						onSelectedBodyIdsChange={setTransitingBodies}
					/>
				);

			case 'transited-bodies':
				return (
					<BodySelector
						theme={theme}
						glyphSet={glyphSet}
						subtitleKey="transits_subtitle_transited"
						selectedBodyIds={transitedBodies}
						onSelectedBodyIdsChange={setTransitedBodies}
					/>
				);

			case 'aspects':
				return (
					<div className="space-y-6">
						<p className={cn('text-sm', ft.muted)}>{t('transits_aspects_subtitle')}</p>
						<AspectSelector
							theme={theme}
							selectedAspectIds={selectedAspects}
							onSelectedAspectIdsChange={setSelectedAspects}
						/>
					</div>
				);
		}
	};

	const isWideBodiesSection = section === 'transiting-bodies' || section === 'transited-bodies';
	const hasTransitFeedback = transitLoading || transitError || transitSeries.length > 0;

	return (
		<AppMainContentRoot>
			<AppMainContentContainer
				layout="center-column"
				maxWidth={isWideBodiesSection ? '6xl' : '4xl'}
			>
				{renderContent()}
				{hasTransitFeedback && (
					<Card variant="ghost" className="w-full rounded-xl">
						<CardContent className="p-6 md:p-8">
							{transitLoading && (
								<div className={cn('text-xs', ft.muted)}>{t('transit_loading')}</div>
							)}
							{transitError && <div className="text-destructive text-xs">{transitError}</div>}
							{transitSeries.length > 0 && (
								<div>
									<div className={cn('mb-2 text-xs font-medium', ft.muted)}>
										{transitResultsCountLabel}
									</div>
									<div className="max-h-64 overflow-auto rounded-md border">
										<table className="w-full border-collapse text-xs">
											<thead className="bg-background sticky top-0 border-b">
												<tr>
													<th className={cn('p-2 text-left font-semibold', ft.bodyText)}>
														{t('column_time')}
													</th>
													<th className={cn('p-2 text-left font-semibold', ft.bodyText)}>
														{t('column_bodies')}
													</th>
													<th className={cn('p-2 text-left font-semibold', ft.bodyText)}>
														{t('aspects')}
													</th>
												</tr>
											</thead>
											<tbody>
												{transitSeries.slice(0, 50).map((entry) => (
													<tr
														key={entry.datetime}
														className="hover:bg-accent/50 border-b transition-colors"
													>
														<td className={cn('p-2', ft.bodyText)}>{entry.datetime}</td>
														<td className={cn('p-2', ft.bodyText)}>
															{Object.keys(entry.transit_positions ?? {}).length}
														</td>
														<td className={cn('p-2', ft.bodyText)}>
															{(entry.aspects ?? []).length}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
									{transitSeries.length > 50 && (
										<div className={cn('mt-2 text-xs', ft.muted)}>
											{t('transit_showing_first_50')}
										</div>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
