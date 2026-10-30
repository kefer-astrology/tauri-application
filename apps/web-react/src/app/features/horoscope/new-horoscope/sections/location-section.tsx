import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ModeSwitcher, ModeSwitcherDetails } from '@/app/components/ui/mode-switcher';
import { Tabs, TabsContent } from '@/app/components/ui/tabs';
import { cn } from '@/app/components/ui/utils';
import { LocationSelector } from '@/app/components/location-selector';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import type { EntryRegime } from '@/lib/newHoroscopeForm';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import { searchLocations } from '@/lib/tauri/workspace';
import { FormField, FormSelect } from '../form-controls';
import { LATITUDE_DIRECTIONS, LONGITUDE_DIRECTIONS } from '../options';
import type { NewHoroscopeForm } from '../use-new-horoscope-form';

const SUGGESTED_LOCATIONS = [
	'Prague, Czech Republic',
	'Brno, Czech Republic',
	'Pardubice, Czech Republic',
	'Bratislava, Slovakia',
	'Vienna, Austria'
];

/** Place of the event: searched and geocoded (auto), or typed with coordinates (manual). */
export function LocationSection({
	form,
	workspaceDefaults
}: {
	form: NewHoroscopeForm;
	workspaceDefaults: WorkspaceDefaultsState;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { state } = form;
	const suggestions = useMemo(
		() => [workspaceDefaults.locationName, ...SUGGESTED_LOCATIONS].filter(Boolean),
		[workspaceDefaults.locationName]
	);

	return (
		<Tabs
			value={state.locationRegime}
			onValueChange={(value) => form.update({ locationRegime: value as EntryRegime })}
			className="gap-3"
		>
			<div className="flex flex-col gap-2">
				<TabsContent value="auto" className="flex flex-col gap-2">
					<Label className={cn('mb-1.5 block', ft.label)}>{t('new_location')}</Label>
					<LocationSelector
						id="location"
						value={state.location}
						onValueChange={form.setLocationText}
						options={suggestions}
						placeholder={t('new_placeholder_any_location')}
						emptyLabel={t('new_placeholder_any_location')}
						loadingLabel={t('new_resolving_location')}
						className={ft.selectTrigger}
						iconClassName={ft.iconColor}
						searchLocations={searchLocations}
						onResolvedLocationSelect={form.applyResolvedLocation}
					/>
				</TabsContent>
				<TabsContent value="manual" className="flex flex-col gap-2">
					<Label htmlFor="manual-location" className={cn('mb-1.5 block', ft.label)}>
						{t('new_location')}
					</Label>
					<Input
						id="manual-location"
						value={state.location}
						onChange={(event) => form.setLocationText(event.target.value)}
						placeholder={t('new_placeholder_any_location')}
						className={cn(ft.input, 'shadow-inner')}
					/>
				</TabsContent>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Label className={ft.label}>{t('new_location_regime')}</Label>
				<ModeSwitcher
					value={state.locationRegime}
					onValueChange={(locationRegime) => form.update({ locationRegime })}
					ariaLabel={t('new_location_regime')}
					options={[
						{ value: 'auto', label: t('new_time_regime_auto') },
						{ value: 'manual', label: t('new_time_regime_manual') }
					]}
				/>
			</div>

			<ModeSwitcherDetails
				open={state.locationRegime === 'manual'}
				contentClassName={cn('space-y-3', ft.advancedPanel)}
			>
				<FormField label={t('current_info_latitude')} htmlFor="latitude">
					<div className="flex gap-2">
						<Input
							type="text"
							id="latitude"
							value={state.latitude}
							onChange={(event) => form.update({ latitude: event.target.value })}
							placeholder="50.0755"
							className={cn(ft.input, 'flex-1 shadow-inner')}
						/>
						<FormSelect
							value={state.latitudeDir}
							onValueChange={(latitudeDir) => form.update({ latitudeDir })}
							options={LATITUDE_DIRECTIONS.map((dir) => ({
								value: dir.id,
								label: t(dir.labelKey)
							}))}
							triggerClassName="w-28 shrink-0"
						/>
					</div>
				</FormField>
				<FormField label={t('current_info_longitude')} htmlFor="longitude">
					<div className="flex gap-2">
						<Input
							type="text"
							id="longitude"
							value={state.longitude}
							onChange={(event) => form.update({ longitude: event.target.value })}
							placeholder="14.4378"
							className={cn(ft.input, 'flex-1 shadow-inner')}
						/>
						<FormSelect
							value={state.longitudeDir}
							onValueChange={(longitudeDir) => form.update({ longitudeDir })}
							options={LONGITUDE_DIRECTIONS.map((dir) => ({
								value: dir.id,
								label: t(dir.labelKey)
							}))}
							triggerClassName="w-28 shrink-0"
						/>
					</div>
				</FormField>
			</ModeSwitcherDetails>
		</Tabs>
	);
}
