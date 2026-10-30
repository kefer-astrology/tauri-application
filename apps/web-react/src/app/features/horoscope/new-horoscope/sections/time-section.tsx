import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Combobox } from '@/app/components/ui/combobox';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ModeSwitcher, ModeSwitcherDetails } from '@/app/components/ui/mode-switcher';
import { Tabs } from '@/app/components/ui/tabs';
import { cn } from '@/app/components/ui/utils';
import { DatePickerInput } from '@/app/components/date-picker-input';
import { TimeRollerPicker } from '@/app/components/time-roller-picker';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import type { EntryRegime } from '@/lib/newHoroscopeForm';
import { dateFnsLocale } from '@/lib/time/dateFnsLocale';
import { TIME_ZONE_REGIONS, timeZonesInRegion, UTC_OFFSET_OPTIONS } from '@/lib/time/zoneCatalog';
import { FormField, FormSelect } from '../form-controls';
import { TIME_SYSTEMS } from '../options';
import type { NewHoroscopeForm } from '../use-new-horoscope-form';

/** Time system, the date and time in it, and the time regime (zone from the place, or chosen). */
export function TimeSection({ form }: { form: NewHoroscopeForm }) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { state } = form;
	const locale = useMemo(() => dateFnsLocale(i18n.language), [i18n.language]);
	const zones = useMemo(() => timeZonesInRegion(state.timezoneRegion), [state.timezoneRegion]);
	const regimeOptions = [
		{ value: 'auto' as const, label: t('new_time_regime_auto') },
		{ value: 'manual' as const, label: t('new_time_regime_manual') }
	];

	return (
		<Tabs
			value={state.timeRegime}
			onValueChange={(value) => form.update({ timeRegime: value as EntryRegime })}
			className="gap-3"
		>
			<div className="flex flex-col gap-2">
				<Label className={cn('mb-1.5 block', ft.label)}>{t('new_time_system')}</Label>
				<FormSelect
					value={state.timeSystem}
					onValueChange={form.setTimeSystem}
					options={TIME_SYSTEMS.map((system) => ({ value: system.id, label: t(system.labelKey) }))}
				/>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div
					className={cn(
						'flex flex-col gap-2',
						state.timeSystem === 'julian_day' && 'md:col-span-2'
					)}
				>
					<Label htmlFor="new-chart-date" className={cn('mb-1.5 block', ft.label)}>
						{state.timeSystem === 'julian_day'
							? t('new_julian_day')
							: state.timeSystem === 'julian_calendar'
								? t('new_julian_calendar_date')
								: t('new_date')}
					</Label>
					{state.timeSystem === 'julian_day' ? (
						<Input
							id="new-chart-date"
							type="text"
							inputMode="decimal"
							value={state.julianDay}
							onChange={(event) => form.update({ julianDay: event.target.value })}
							placeholder="2451545.0"
							className={cn(ft.input, 'shadow-inner')}
						/>
					) : state.timeSystem === 'julian_calendar' ? (
						<Input
							id="new-chart-date"
							type="text"
							inputMode="numeric"
							value={state.julianCalendarDate}
							onChange={(event) => form.update({ julianCalendarDate: event.target.value })}
							placeholder="YYYY-MM-DD"
							className={cn(ft.input, 'shadow-inner')}
						/>
					) : (
						<DatePickerInput
							id="new-chart-date"
							label={t('new_date')}
							value={state.dateTime}
							onValueChange={(dateTime) => form.update({ dateTime })}
							locale={locale}
							showLabel={false}
							iconClassName={ft.iconColor}
							panelClassName={ft.datePicker}
						/>
					)}
				</div>

				<div className={cn('flex flex-col gap-2', state.timeSystem === 'julian_day' && 'hidden')}>
					<TimeRollerPicker
						id="new-chart-time"
						label={t('new_time')}
						value={state.dateTime}
						onValueChange={(dateTime) => form.update({ dateTime })}
						labelClassName={ft.label}
						iconClassName={ft.iconColor}
						panelClassName={ft.selectContent}
					/>
				</div>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Label className={ft.label}>{t('new_time_regime')}</Label>
				<ModeSwitcher
					value={state.timeRegime}
					onValueChange={(timeRegime) => form.update({ timeRegime })}
					ariaLabel={t('new_time_regime')}
					options={regimeOptions}
				/>
			</div>

			<ModeSwitcherDetails
				open={state.timeRegime === 'manual'}
				contentClassName={cn('space-y-3', ft.advancedPanel)}
			>
				<FormField label={t('new_timezone_region')}>
					<FormSelect
						value={state.timezoneRegion}
						onValueChange={form.setTimeZoneRegion}
						options={TIME_ZONE_REGIONS.map((region) => ({ value: region, label: region }))}
					/>
				</FormField>
				<FormField label={t('new_timezone')}>
					<Combobox
						value={state.timezone}
						onValueChange={(timezone) => form.update({ timezone })}
						options={zones}
						placeholder={t('new_timezone_placeholder')}
						emptyLabel={t('new_timezone_no_results')}
						triggerClassName={cn(ft.selectTrigger, 'shadow-inner px-4 py-2.5')}
						contentClassName={ft.selectContent}
						itemClassName={ft.selectItem}
					/>
				</FormField>
				<FormField label={t('new_utc_offset')}>
					<FormSelect
						value={state.utcOffset}
						onValueChange={(utcOffset) => form.update({ utcOffset })}
						options={[
							{ value: 'auto', label: t('new_time_regime_auto') },
							...UTC_OFFSET_OPTIONS.map((offset) => ({ value: offset, label: offset }))
						]}
					/>
				</FormField>
			</ModeSwitcherDetails>
		</Tabs>
	);
}
