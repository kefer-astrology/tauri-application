import { Text } from '@/app/components/ui/typography';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/app/components/ui/label';
import { ModeSwitcher, ModeSwitcherDetails } from '@/app/components/ui/mode-switcher';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';
import { DatePickerInput } from '@/app/components/ui/date-picker-input';
import { LocationSelector } from '@/app/views/domain/location-selector';
import { TimeRollerPicker } from '@/app/components/ui/time-roller-picker';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import { chartTimeZone, splitChartDateTime } from '@/lib/chartDateTime';
import {
	localDateValue,
	localTimeValue,
	personDateTime,
	type SynastryPerson
} from '@/lib/synastryForm';
import { searchLocations } from '@/lib/tauri/workspace';
import { dateFnsLocale } from '@/lib/time/dateFnsLocale';

/** One person: a saved chart, or date, time and place entered by hand. */
export function PersonFields({
	person,
	onChange,
	personLabel
}: {
	person: SynastryPerson;
	onChange: (person: SynastryPerson) => void;
	/** Accessible name and id prefix (`person-a`). */
	personLabel: string;
}) {
	const { t, i18n } = useTranslation();
	const { charts } = useWorkspaceCharts();
	const ft = useAppFormFieldTheme();
	const manual = person.mode === 'manual';
	const dateTime = useMemo(
		() => personDateTime(person.date, person.time),
		[person.date, person.time]
	);
	const locale = useMemo(() => dateFnsLocale(i18n.language), [i18n.language]);
	const locationOptions = useMemo(
		() => charts.map((chart) => chart.location).filter(Boolean),
		[charts]
	);
	const set = <K extends keyof SynastryPerson>(key: K, value: SynastryPerson[K]) =>
		onChange({ ...person, [key]: value });

	return (
		<div className="space-y-4">
			<div>
				<Label variant="eyebrow" tone="muted" className="mb-2">
					{t('synastry_chart')}
				</Label>
				<Select
					value={person.chartId}
					onValueChange={(value) => set('chartId', value)}
					disabled={manual || charts.length === 0}
				>
					<SelectTrigger variant="form" aria-label={personLabel}>
						<SelectValue
							placeholder={charts.length ? t('synastry_choose_chart') : t('synastry_no_charts')}
						/>
					</SelectTrigger>
					<SelectContent variant="form">
						{charts.map((chart) => {
							const { date, time } = splitChartDateTime(chart.dateTime, chartTimeZone(chart));
							return (
								<SelectItem variant="form" key={chart.id} value={chart.id}>
									<span className="flex min-w-0 flex-col">
										<span className="truncate">{chart.name}</span>
										<Text variant="caption" as="span" tone="muted" className="truncate">
											{date} {time} · {chart.location}
										</Text>
									</span>
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Label variant="default" tone="secondary">
					{t('synastry_input_mode')}
				</Label>
				<ModeSwitcher
					value={person.mode}
					onValueChange={(value) => set('mode', value)}
					ariaLabel={t('synastry_input_mode')}
					options={[
						{ value: 'database', label: t('synastry_database') },
						{ value: 'manual', label: t('synastry_manual') }
					]}
				/>
			</div>

			<ModeSwitcherDetails open={manual} contentClassName={cn('space-y-3', ft.advancedPanel)}>
				<div className="grid gap-3 sm:grid-cols-2">
					<DatePickerInput
						id={`${personLabel}-date`}
						label={t('synastry_date')}
						value={dateTime}
						onValueChange={(value) => set('date', localDateValue(value))}
						locale={locale}
						labelClassName={ft.label}
						iconClassName={ft.iconColor}
					/>
					<TimeRollerPicker
						id={`${personLabel}-time`}
						label={t('synastry_time')}
						value={dateTime}
						onValueChange={(value) => set('time', localTimeValue(value))}
						labelClassName={ft.label}
						iconClassName={ft.iconColor}
					/>
				</div>
				<div>
					<Label
						variant="default"
						tone="secondary"
						className="mb-1.5 block"
						htmlFor={`${personLabel}-location`}
					>
						{t('synastry_location')}
					</Label>
					<LocationSelector
						id={`${personLabel}-location`}
						value={person.location}
						onValueChange={(value) =>
							onChange({
								...person,
								location: value,
								latitude: undefined,
								longitude: undefined,
								timezone: undefined
							})
						}
						options={locationOptions}
						placeholder={t('synastry_location_placeholder')}
						emptyLabel={t('synastry_location_placeholder')}
						loadingLabel={t('new_resolving_location')}
						searchLocations={searchLocations}

						iconClassName={ft.iconColor}
						onResolvedLocationSelect={(result) =>
							onChange({
								...person,
								location: result.display_name,
								latitude: result.latitude,
								longitude: result.longitude,
								timezone: result.timezone
							})
						}
					/>
				</div>
			</ModeSwitcherDetails>
		</div>
	);
}
