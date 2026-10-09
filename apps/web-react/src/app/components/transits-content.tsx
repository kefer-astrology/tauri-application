import { useMemo } from 'react';
import { addMonths, addYears } from 'date-fns';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ModeSwitcherDetails } from './ui/mode-switcher';
import { Separator } from './ui/separator';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { DatePickerInput } from './date-picker-input';
import { TimeRollerPicker } from './time-roller-picker';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import {
	PERIOD_PRESET_IDS,
	humanizePeriodPresetId,
	useTransitsWorkspace,
	type TimeStepUnit
} from '../providers/transits-workspace';
import type { TransitSection } from './transits-secondary-sidebar';
import { AspectSelector } from './aspect-selector';
import { BodySelector } from './body-selector';
import { ConfigurationSelector } from './configuration-selector';
import type { Theme } from './astrology-sidebar';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';

interface TransitsContentProps {
	section: TransitSection;
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
}

type DropdownOption = { id: string; label: string };

/** `current`/`custom` keep their existing special handling (single instant / user-edited range,
 *  respectively, in `handleComputeTransits`) — every other id computes a fixed `[from, to]` range
 *  from "now" at selection time, shown (but not editable) in the always-visible calendar area
 *  below; only `custom` allows editing it. */
const PERIOD_PRESET_RANGES: Partial<Record<(typeof PERIOD_PRESET_IDS)[number], (now: Date) => [Date, Date]>> = {
	next_3_months: (now) => [now, addMonths(now, 3)],
	next_6_months: (now) => [now, addMonths(now, 6)],
	previous_3_months: (now) => [addMonths(now, -3), now],
	previous_6_months: (now) => [addMonths(now, -6), now],
	next_year: (now) => [now, addYears(now, 1)],
	previous_year: (now) => [addYears(now, -1), now]
};

/** The setup screen for a transit/dynamic-transit computation — shown until a series has been
 *  computed, at which point the results dashboard takes over both this area and the secondary
 *  sidebar (see `TransitsWorkspaceProvider`'s `mode`). */
export function TransitsContent({ section, theme, glyphSet }: TransitsContentProps) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const dateFnsLocale = useMemo(() => {
		const base = i18n.language.split('-')[0]?.toLowerCase() ?? 'en';
		if (base === 'cs') return cs;
		if (base === 'fr') return fr;
		if (base === 'es') return es;
		return enUS;
	}, [i18n.language]);
	const { charts } = useWorkspaceCharts();
	const {
		selectedTypeId,
		setSelectedTypeId,
		periodModeId,
		setPeriodModeId,
		checkboxes,
		setCheckboxes,
		exactHits,
		setExactHits,
		stationEvents,
		setStationEvents,
		sampledGraphOutput,
		setSampledGraphOutput,
		configurationSearches,
		setConfigurationSearches,
		effectiveSourceChartId,
		setSourceChartId,
		fromDateTime,
		setFromDateTime,
		toDateTime,
		setToDateTime,
		transitingBodies,
		setTransitingBodies,
		transitedBodies,
		setTransitedBodies,
		selectedAspects,
		setSelectedAspects,
		timeStepValue,
		setTimeStepValue,
		timeStepUnit,
		setTimeStepUnit,
		estimatedSampleCount,
		transitLoading,
		transitError,
		handleComputeTransits
	} = useTransitsWorkspace();

	const typeOptions = useMemo<DropdownOption[]>(
		() => [
			{ id: 'transit', label: t('transits_general_transit_transit') },
			{ id: 'primary', label: t('transits_general_transit_primary') },
			{ id: 'secondary', label: t('transits_general_transit_secondary') }
		],
		[t]
	);

	const periodOptions = useMemo<DropdownOption[]>(
		() =>
			PERIOD_PRESET_IDS.map((id) => ({
				id,
				label: t(`transits_period_${id}`, { defaultValue: humanizePeriodPresetId(id) })
			})),
		[t]
	);

	function handlePeriodModeChange(id: string) {
		setPeriodModeId(id);
		const computeRange = PERIOD_PRESET_RANGES[id as (typeof PERIOD_PRESET_IDS)[number]];
		if (!computeRange) return;
		const [from, to] = computeRange(new Date());
		setFromDateTime(from);
		setToDateTime(to);
	}

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

							<Separator className="bg-[color:var(--theme-panel-border)]" />

							<div data-tour="transits-period">
								<Label className={cn('mb-2 block', ft.label)}>{t('transits_label_period')}</Label>
								<Select value={periodModeId} onValueChange={handlePeriodModeChange}>
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

							<Separator className="bg-[color:var(--theme-panel-border)]" />

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label className={cn('flex items-start gap-3 cursor-pointer')}>
										<Checkbox
											checked={exactHits}
											onCheckedChange={(checked) => setExactHits(checked === true)}
											className={cn('mt-0.5', ft.checkboxAccent)}
										/>
										<span className={cn('text-sm', ft.bodyText)}>
											{t('transits_exact_hits_label')}
										</span>
									</Label>
									<p className={cn('text-xs pl-7', ft.muted)}>
										{t('transits_exact_hits_hint')}
									</p>
								</div>
								<div className="space-y-1.5">
									<Label className={cn('flex items-start gap-3 cursor-pointer')}>
										<Checkbox
											checked={stationEvents}
											onCheckedChange={(checked) => setStationEvents(checked === true)}
											className={cn('mt-0.5', ft.checkboxAccent)}
										/>
										<span className={cn('text-sm', ft.bodyText)}>
											{t('transits_station_events_label')}
										</span>
									</Label>
									<p className={cn('text-xs pl-7', ft.muted)}>
										{t('transits_station_events_hint')}
									</p>
								</div>
							</div>

							<Separator className="bg-[color:var(--theme-panel-border)]" />

							<div className="space-y-1.5">
								<Label className={cn('flex items-start gap-3 cursor-pointer')}>
									<Checkbox
										checked={sampledGraphOutput}
										onCheckedChange={(checked) => setSampledGraphOutput(checked === true)}
										className={cn('mt-0.5', ft.checkboxAccent)}
									/>
									<span className={cn('text-sm', ft.bodyText)}>
										{t('transits_sampled_graph_output_label', {
											defaultValue: 'Sampled graph output'
										})}
									</span>
								</Label>
								<p className={cn('text-xs pl-7', ft.muted)}>
									{t('transits_sampled_graph_output_hint', {
										defaultValue:
											'Plots the chart/table view below. Turn off if you only want exact events, stations, or configurations.'
									})}
								</p>
							</div>

							<div className="space-y-2">
								<Label className={cn('block', ft.label)}>
									{t('transits_configuration_label', {
										defaultValue: 'Multi-body configurations'
									})}
								</Label>
								<p className={cn('text-xs', ft.muted)}>
									{t('transits_configuration_hint', {
										defaultValue:
											'Finds the time interval during which Grand Trine, T-square, Yod, or Grand Cross is simultaneously in orb, independent of graph sampling.'
									})}
								</p>
								<ConfigurationSelector
									theme={theme}
									searches={configurationSearches}
									onSearchesChange={setConfigurationSearches}
								/>
							</div>

							<ModeSwitcherDetails
								open
								contentClassName={cn('space-y-4', ft.advancedPanel)}
							>
								<div>
									<Label className={cn('mb-2 block', ft.label)}>{t('transits_period_from')}:</Label>
									<div className="grid grid-cols-3 gap-3">
										<DatePickerInput
											label={t('transits_general_item_date')}
											value={fromDateTime}
											onValueChange={setFromDateTime}
											locale={dateFnsLocale}
											showLabel
											disabled={periodModeId !== 'custom'}
											labelClassName={cn('mb-1 block text-xs', ft.muted)}
											iconClassName={ft.iconColor}
											panelClassName={ft.datePicker}
										/>
										<TimeRollerPicker
											label={t('transits_general_item_time')}
											value={fromDateTime}
											onValueChange={setFromDateTime}
											showLabel
											disabled={periodModeId !== 'custom'}
											labelClassName={cn('mb-1 block text-xs', ft.muted)}
											iconClassName={ft.iconColor}
											panelClassName={ft.datePicker}
										/>
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
										<DatePickerInput
											label={t('transits_general_item_date')}
											value={toDateTime}
											onValueChange={setToDateTime}
											locale={dateFnsLocale}
											showLabel
											disabled={periodModeId !== 'custom'}
											labelClassName={cn('mb-1 block text-xs', ft.muted)}
											iconClassName={ft.iconColor}
											panelClassName={ft.datePicker}
										/>
										<TimeRollerPicker
											label={t('transits_general_item_time')}
											value={toDateTime}
											onValueChange={setToDateTime}
											showLabel
											disabled={periodModeId !== 'custom'}
											labelClassName={cn('mb-1 block text-xs', ft.muted)}
											iconClassName={ft.iconColor}
											panelClassName={ft.datePicker}
										/>
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

								{periodModeId !== 'current' && sampledGraphOutput && (
								<div>
									<Label className={cn('mb-2 block', ft.label)}>
										{t('transits_label_graph_sampling_interval', {
											defaultValue: 'Graph sampling interval'
										})}
									</Label>
									<div className="flex items-center gap-3">
										<Input
											type="number"
											min={1}
											step={1}
											value={timeStepValue}
											onChange={(event) => {
												const next = Number.parseInt(event.target.value, 10);
												setTimeStepValue(Number.isFinite(next) && next > 0 ? next : 1);
											}}
											className={cn(ft.input, 'h-10 w-24 py-2 text-sm shadow-inner')}
										/>
										<Select
											value={timeStepUnit}
											onValueChange={(value) => setTimeStepUnit(value as TimeStepUnit)}
										>
											<SelectTrigger className={cn(ft.selectTrigger, 'w-40 shadow-inner')}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent className={ft.selectContent}>
												<SelectItem value="seconds" className={ft.selectItem}>
													{t('transits_granularity_seconds', { defaultValue: 'Seconds' })}
												</SelectItem>
												<SelectItem value="minutes" className={ft.selectItem}>
													{t('transits_granularity_minutes', { defaultValue: 'Minutes' })}
												</SelectItem>
												<SelectItem value="hours" className={ft.selectItem}>
													{t('transits_granularity_hours', { defaultValue: 'Hours' })}
												</SelectItem>
												<SelectItem value="days" className={ft.selectItem}>
													{t('transits_granularity_days', { defaultValue: 'Days' })}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<p className={cn('mt-2 text-xs', ft.muted)}>
										{t('transits_granularity_estimate', {
											count: estimatedSampleCount,
											defaultValue: `~${estimatedSampleCount} samples over the selected period`
										})}
									</p>
									{estimatedSampleCount > 20000 && (
										<p className="text-destructive mt-1 text-xs">
											{t('transits_granularity_warning', {
												defaultValue:
													'That many samples may take a while to compute and render. Consider a coarser step.'
											})}
										</p>
									)}
								</div>
								)}
							</ModeSwitcherDetails>

							{transitError && <div className="text-destructive text-xs">{transitError}</div>}

							<div className="pt-6">
								<Button
									data-tour="transits-calculate"
									type="button"
									className={cn(ft.footerPrimary, 'w-full')}
									onClick={() => void handleComputeTransits()}
									disabled={transitLoading}
								>
									{transitLoading ? t('transit_loading') : t('calculate')}
								</Button>
							</div>
						</CardContent>
					</Card>
				);

			// "Transiting Bodies" (tranzitující = active/moving) edits `transitingBodies` — the side
			// swept across the whole period; "Transited Bodies" (tranzitovaná = passive/fixed) edits
			// `transitedBodies` — the fixed anchor(s), held at the source chart's own moment and
			// shown in the results sidebar once computed. Conventional meaning, grammatically
			// correct in both languages — see the note in transits-workspace.tsx.
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

	return (
		<AppMainContentRoot>
			<AppMainContentContainer width="wide">{renderContent()}</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
