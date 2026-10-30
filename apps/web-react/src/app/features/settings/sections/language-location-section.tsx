import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { LocationSelector } from '@/app/components/location-selector';
import { useWorkspace } from '@/app/providers/workspace';
import type { AppLanguage } from '@/lib/i18n';
import type { WorkspaceDefaultsState } from '@/lib/tauri/chartPayload';
import { searchLocations } from '@/lib/tauri/workspace';
import { SettingSelect } from '../settings-controls';
import { useSettingsDraft } from '../settings-draft';

/** Each language's own autonym, so users recognize their language whatever the UI language. */
const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
	{ value: 'cs', label: 'Čeština' },
	{ value: 'en', label: 'English' },
	{ value: 'fr', label: 'Français' },
	{ value: 'es', label: 'Español' }
];

/** App language (applies immediately) and the workspace default location. Coordinates and
 *  timezone are saved when the field loses focus or a searched location is picked. */
export function LanguageLocationSection() {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { workspaceDefaults, applyDefaultsPatch } = useWorkspace();
	const { markChanged } = useSettingsDraft();
	const [locationName, setLocationName] = useState(workspaceDefaults.locationName);
	const [latitude, setLatitude] = useState(String(workspaceDefaults.locationLatitude));
	const [longitude, setLongitude] = useState(String(workspaceDefaults.locationLongitude));
	const [timezone, setTimezone] = useState(workspaceDefaults.timezone);

	useEffect(() => {
		setLocationName(workspaceDefaults.locationName);
		setLatitude(String(workspaceDefaults.locationLatitude));
		setLongitude(String(workspaceDefaults.locationLongitude));
		setTimezone(workspaceDefaults.timezone);
	}, [workspaceDefaults]);

	const persistLocation = (patch?: Partial<WorkspaceDefaultsState>) => {
		const parsedLatitude = Number(latitude);
		const parsedLongitude = Number(longitude);
		void applyDefaultsPatch({
			locationName: locationName.trim() || workspaceDefaults.locationName,
			locationLatitude: Number.isFinite(parsedLatitude)
				? parsedLatitude
				: workspaceDefaults.locationLatitude,
			locationLongitude: Number.isFinite(parsedLongitude)
				? parsedLongitude
				: workspaceDefaults.locationLongitude,
			timezone: timezone.trim() || workspaceDefaults.timezone,
			...patch
		});
	};

	const textField = (
		label: string,
		value: string,
		setValue: (value: string) => void,
		placeholder: string
	) => (
		<div className="space-y-2">
			<Label className={ft.label}>{label}</Label>
			<Input
				value={value}
				onChange={(event) => {
					setValue(event.target.value);
					markChanged();
				}}
				onBlur={() => persistLocation()}
				placeholder={placeholder}
				className={cn(ft.input, 'shadow-inner')}
			/>
		</div>
	);

	const currentLanguage =
		LANGUAGE_OPTIONS.find(
			(option) => i18n.language === option.value || i18n.language.startsWith(`${option.value}-`)
		)?.value ?? '';

	return (
		<div className="space-y-6">
			<SettingSelect
				label={t('language')}
				hint={t('select_language')}
				ariaLabel={t('label_languages')}
				narrow
				value={currentLanguage}
				options={LANGUAGE_OPTIONS}
				onValueChange={(language) => {
					void i18n.changeLanguage(language);
					markChanged();
				}}
			/>

			<Separator className="bg-[color:var(--theme-panel-border)]" />

			<div className="space-y-2">
				<Label className={ft.label}>{t('default_location')}</Label>
				<LocationSelector
					value={locationName}
					onValueChange={(next) => {
						setLocationName(next);
						markChanged();
					}}
					searchLocations={searchLocations}
					onResolvedLocationSelect={(location) => {
						setLocationName(location.display_name);
						setLatitude(String(location.latitude));
						setLongitude(String(location.longitude));
						markChanged();
						persistLocation({
							locationName: location.display_name,
							locationLatitude: location.latitude,
							locationLongitude: location.longitude
						});
					}}
					placeholder={t('placeholder_default_location')}
					emptyLabel={t('open_search_no_results')}
					loadingLabel={t('new_resolving_location')}
					className={cn(ft.selectTrigger, 'shadow-inner')}
					iconClassName={ft.muted}
				/>
				<p className={cn('text-xs', ft.muted)}>
					{t('settings_default_location_hint', {
						defaultValue:
							'Choose a searched location to sync its coordinates, or adjust latitude and longitude manually below.'
					})}
				</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				{textField(t('current_info_latitude'), latitude, setLatitude, t('placeholder_latitude'))}
				{textField(
					t('current_info_longitude'),
					longitude,
					setLongitude,
					t('placeholder_longitude')
				)}
			</div>
			{textField(t('current_info_timezone'), timezone, setTimezone, t('placeholder_utc_offset'))}
		</div>
	);
}
