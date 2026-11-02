import { Text } from '@/app/components/ui/typography';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ModeSwitcherDetails } from '@/app/components/ui/mode-switcher';
import { Separator } from '@/app/components/ui/separator';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import {
	humanizePeriodPresetId,
	PERIOD_PRESET_IDS,
	periodPresetRange,
	type TransitSetupState
} from '@/lib/astrology/transitSetup';
import { TimeStepUnitSelect } from '../time-step-unit-select';
import { useTransits } from '../transits-provider';
import { ConfigurationSelector } from './configuration-selector';
import { PeriodBoundFields } from './period-bound-fields';
import { CheckOption, SetupSelect } from './setup-controls';

const TRANSIT_TYPES = [
	{ id: 'transit', labelKey: 'transits_general_transit_transit' },
	{ id: 'primary', labelKey: 'transits_general_transit_primary' },
	{ id: 'secondary', labelKey: 'transits_general_transit_secondary' }
];

/** Options that are not implemented yet: shown disabled, in two columns. */
const PLANNED_OPTIONS: { id: keyof TransitSetupState['checkboxes']; labelKey: string }[][] = [
	[
		{ id: 'houseTransitions', labelKey: 'transits_general_crossings' },
		{ id: 'signTransitions', labelKey: 'transits_general_crossings_2' }
	],
	[
		{ id: 'transitLimits', labelKey: 'transits_general_transit_2' },
		{ id: 'precessionCorrection', labelKey: 'transits_general_precession' }
	]
];

const separator = <Separator className="bg-[color:var(--theme-panel-border)]" />;

/** What to compute: type, period, chart, options, event searches, configurations, sampling. */
export function GeneralSection() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { charts } = useWorkspaceCharts();
	const { setup, updateSetup, sourceChartId, setSourceChartId, loading, error, compute } =
		useTransits();

	const choosePeriod = (periodModeId: string) => {
		const range = periodPresetRange(periodModeId, new Date());
		updateSetup(
			range ? { periodModeId, fromDateTime: range[0], toDateTime: range[1] } : { periodModeId }
		);
	};

	return (
		<Card variant="ghost" className="w-full rounded-xl">
			<CardContent className="flex flex-col space-y-6 p-6 md:p-8">
				<Text variant="body" tone="muted">
					{t('transits_subtitle_general')}
				</Text>

				<SetupSelect
					label={t('transits_label_type')}
					value={setup.selectedTypeId}
					onValueChange={(selectedTypeId) => updateSetup({ selectedTypeId })}
					options={TRANSIT_TYPES.map((type) => ({
						value: type.id,
						label: t(type.labelKey),
						disabled: type.id !== 'transit'
					}))}
				/>

				{separator}

				<SetupSelect
					dataTour="transits-period"
					label={t('transits_label_period')}
					value={setup.periodModeId}
					onValueChange={choosePeriod}
					options={PERIOD_PRESET_IDS.map((id) => ({
						value: id,
						label: t(`transits_period_${id}`, { defaultValue: humanizePeriodPresetId(id) })
					}))}
				/>

				<SetupSelect
					label={t('sidebar_horoscope')}
					value={sourceChartId || '__none'}
					onValueChange={(value) => {
						if (value !== '__none') setSourceChartId(value);
					}}
					options={
						charts.length === 0
							? [{ value: '__none', label: t('open_table_empty'), disabled: true }]
							: charts.map((chart) => ({ value: chart.id, label: chart.name }))
					}
				/>

				<div className="grid grid-cols-2 gap-4">
					{PLANNED_OPTIONS.map((column, index) => (
						<div key={index} className="space-y-3">
							{column.map((option) => (
								<CheckOption
									key={option.id}
									label={t(option.labelKey)}
									checked={setup.checkboxes[option.id]}
									onCheckedChange={(checked) =>
										updateSetup({ checkboxes: { ...setup.checkboxes, [option.id]: checked } })
									}
									disabled
								/>
							))}
						</div>
					))}
				</div>

				{separator}

				<div className="grid grid-cols-2 gap-4">
					<CheckOption
						label={t('transits_exact_hits_label')}
						hint={t('transits_exact_hits_hint')}
						checked={setup.exactHits}
						onCheckedChange={(exactHits) => updateSetup({ exactHits })}
					/>
					<CheckOption
						label={t('transits_station_events_label')}
						hint={t('transits_station_events_hint')}
						checked={setup.stationEvents}
						onCheckedChange={(stationEvents) => updateSetup({ stationEvents })}
					/>
				</div>

				{separator}

				<CheckOption
					label={t('transits_sampled_graph_output_label', { defaultValue: 'Sampled graph output' })}
					hint={t('transits_sampled_graph_output_hint', {
						defaultValue:
							'Plots the chart/table view below. Turn off if you only want exact events, stations, or configurations.'
					})}
					checked={setup.sampledGraphOutput}
					onCheckedChange={(sampledGraphOutput) => updateSetup({ sampledGraphOutput })}
				/>

				<div className="space-y-2">
					<Label className="block">
						{t('transits_configuration_label', { defaultValue: 'Multi-body configurations' })}
					</Label>
					<Text variant="caption" tone="muted">
						{t('transits_configuration_hint', {
							defaultValue:
								'Finds the time interval during which Grand Trine, T-square, Yod, or Grand Cross is simultaneously in orb, independent of graph sampling.'
						})}
					</Text>
					<ConfigurationSelector
						searches={setup.configurationSearches}
						onSearchesChange={(configurationSearches) => updateSetup({ configurationSearches })}
					/>
				</div>

				<ModeSwitcherDetails open contentClassName={cn('space-y-4', ft.advancedPanel)}>
					<PeriodBoundFields
						label={t('transits_period_from')}
						value={setup.fromDateTime}
						onValueChange={(fromDateTime) => updateSetup({ fromDateTime })}
						disabled={setup.periodModeId !== 'custom'}
					/>
					<PeriodBoundFields
						label={t('transits_period_to')}
						value={setup.toDateTime}
						onValueChange={(toDateTime) => updateSetup({ toDateTime })}
						disabled={setup.periodModeId !== 'custom'}
					/>
					{setup.periodModeId !== 'current' && setup.sampledGraphOutput && <SamplingInterval />}
				</ModeSwitcherDetails>

				{error && <div className="text-destructive text-xs">{error}</div>}

				<div className="pt-6">
					<Button
						variant="form-primary"
						size="form"
						data-tour="transits-calculate"
						type="button"
						className="w-full flex-1"
						onClick={() => void compute()}
						disabled={loading}
					>
						{loading ? t('transit_loading') : t('calculate')}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

/** Graph sampling step with the expected sample count. */
function SamplingInterval() {
	const { t } = useTranslation();

	const { setup, updateSetup, estimatedSampleCount } = useTransits();

	return (
		<div>
			<Label className="mb-2 block">
				{t('transits_label_graph_sampling_interval', { defaultValue: 'Graph sampling interval' })}
			</Label>
			<div className="flex items-center gap-3">
				<Input
					variant="form"
					type="number"
					min={1}
					step={1}
					value={setup.timeStepValue}
					onChange={(event) => {
						const next = Number.parseInt(event.target.value, 10);
						updateSetup({ timeStepValue: Number.isFinite(next) && next > 0 ? next : 1 });
					}}
					className="h-10 w-24 py-2 text-sm shadow-inner"
				/>
				<TimeStepUnitSelect
					value={setup.timeStepUnit}
					onValueChange={(timeStepUnit) => updateSetup({ timeStepUnit })}
					triggerClassName="w-40 shadow-inner"
				/>
			</div>
			<Text variant="caption" tone="muted" className="mt-2">
				{t('transits_granularity_estimate', {
					count: estimatedSampleCount,
					defaultValue: `~${estimatedSampleCount} samples over the selected period`
				})}
			</Text>
			{estimatedSampleCount > 20000 && (
				<Text variant="caption" className="text-destructive mt-1">
					{t('transits_granularity_warning', {
						defaultValue:
							'That many samples may take a while to compute and render. Consider a coarser step.'
					})}
				</Text>
			)}
		</div>
	);
}
