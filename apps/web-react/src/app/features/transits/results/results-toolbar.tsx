import { Text } from '@/app/components/ui/typography';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ModeSwitcher } from '@/app/components/ui/mode-switcher';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { X_ZOOM_PRESET_MS, xZoomWindow, type XZoomPreset } from '@/lib/astrology/transitResults';
import { humanizePeriodPresetId, type TimeStepUnit } from '@/lib/astrology/transitSetup';
import { formatDateTimeRange } from '@/lib/time/format';
import { TimeStepUnitSelect } from '../time-step-unit-select';
import { useTransits } from '../transits-provider';
import type { TransitsResultsViewMode } from '../use-results-view';

const ZOOM_PRESETS = Object.keys(X_ZOOM_PRESET_MS) as XZoomPreset[];

/** Results toolbar: chart / table switch, chart zoom, what was computed, the sampling step
 *  (recomputes on change), and Edit setup / Reset. */
export function ResultsToolbar() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { view, series, timelineCategories, setup, updateSetup, compute, editSetup, reset } =
		useTransits();
	const chartMode = view.viewMode === 'chart';

	// The submitted period: `current` is one instant by design, so a single point is expected;
	// every other period shows its range too.
	const periodLabel = t(`transits_period_${setup.periodModeId}`, {
		defaultValue: humanizePeriodPresetId(setup.periodModeId)
	});
	const periodSummary =
		setup.periodModeId === 'current'
			? periodLabel
			: `${periodLabel}: ${formatDateTimeRange(setup.fromDateTime, setup.toDateTime)}`;

	const [pendingStep, setPendingStep] = useState(String(setup.timeStepValue));
	useEffect(() => setPendingStep(String(setup.timeStepValue)), [setup.timeStepValue]);

	const commitStep = () => {
		const next = Number.parseInt(pendingStep, 10);
		const resolved = Number.isFinite(next) && next > 0 ? next : setup.timeStepValue;
		setPendingStep(String(resolved));
		if (resolved !== setup.timeStepValue) {
			updateSetup({ timeStepValue: resolved });
			void compute();
		}
	};

	const changeUnit = (timeStepUnit: TimeStepUnit) => {
		updateSetup({ timeStepUnit });
		void compute();
	};

	const toolButton = cn('h-8 px-2.5 text-xs', ft.bodyText);

	return (
		<div
			className={cn(
				'flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3',
				'border-[color:var(--theme-panel-border)]'
			)}
		>
			<ModeSwitcher
				value={view.viewMode}
				onValueChange={(mode: TransitsResultsViewMode) => view.setViewMode(mode)}
				ariaLabel={t('aspect_timeline_axis_closeness', { defaultValue: 'Orb to exact' })}
				options={[
					{ value: 'chart', label: t('transits_resonance_view', { defaultValue: 'Resonance' }) },
					{ value: 'table', label: t('aspect_timeline_hits_view', { defaultValue: 'Exact hits' }) }
				]}
			/>

			{chartMode && (
				<div className="flex items-center gap-1">
					{ZOOM_PRESETS.map((preset) => (
						<Button
							key={preset}
							type="button"
							variant="ghost"
							className={toolButton}
							onClick={() => {
								const window = xZoomWindow(preset, timelineCategories, view.visibleRange);
								if (window) view.setVisibleRange(window);
							}}
						>
							{t(`transits_zoom_${preset}`, {
								defaultValue: preset.charAt(0).toUpperCase() + preset.slice(1)
							})}
						</Button>
					))}
					{view.visibleRange && (
						<Button
							type="button"
							variant="ghost"
							className={toolButton}
							onClick={() => view.setVisibleRange(null)}
						>
							{t('transits_zoom_full_range', { defaultValue: 'Full range' })}
						</Button>
					)}
				</div>
			)}

			{chartMode && (
				<div className="flex items-center gap-1.5">
					<Text variant="caption" as="span" tone="muted">
						{t('transits_y_zoom_label', { defaultValue: 'Orb scale' })}
					</Text>
					<Button
						type="button"
						variant="ghost"
						className={cn('h-8 w-8 px-0 text-xs', ft.bodyText)}
						onClick={() => view.setYZoomDegrees(view.yZoomDegrees - 0.1)}
					>
						−
					</Button>
					<Input
						variant="form"
						density="compact"
						type="number"
						min={0.5}
						max={6}
						step={0.1}
						value={view.yZoomDegrees}
						onChange={(event) => {
							const n = Number(event.target.value);
							if (Number.isFinite(n)) view.setYZoomDegrees(n);
						}}
						className="h-8 w-16 text-xs shadow-inner"
					/>
					<Button
						type="button"
						variant="ghost"
						className={cn('h-8 w-8 px-0 text-xs', ft.bodyText)}
						onClick={() => view.setYZoomDegrees(view.yZoomDegrees + 0.1)}
					>
						+
					</Button>
				</div>
			)}

			<Text variant="caption" as="span" tone="muted" className="tabular-nums">
				{t('transit_results_count').replace('{count}', String(series.length))} · {periodSummary}
			</Text>

			<div className="flex items-center gap-2">
				<Text variant="caption" as="span" tone="muted">
					{t('transits_label_graph_sampling_interval', { defaultValue: 'Graph sampling interval' })}
				</Text>
				<Input
					variant="form"
					type="number"
					min={1}
					step={1}
					value={pendingStep}
					onChange={(event) => setPendingStep(event.target.value)}
					onBlur={commitStep}
					onKeyDown={(event) => {
						if (event.key === 'Enter') commitStep();
					}}
					disabled={!setup.sampledGraphOutput}
					className="h-8 w-16 py-1 text-xs shadow-inner"
				/>
				<TimeStepUnitSelect
					value={setup.timeStepUnit}
					onValueChange={changeUnit}
					disabled={!setup.sampledGraphOutput}
					triggerClassName="h-8 w-28 text-xs shadow-inner"
				/>
			</div>

			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					className={cn('h-8 px-3 text-xs', ft.bodyText)}
					onClick={editSetup}
				>
					{t('transits_edit_setup', { defaultValue: 'Edit setup' })}
				</Button>
				<Button
					type="button"
					variant="ghost"
					className={cn('h-8 px-3 text-xs', ft.bodyText)}
					onClick={reset}
				>
					{t('transits_reset', { defaultValue: 'Reset' })}
				</Button>
			</div>
		</div>
	);
}
