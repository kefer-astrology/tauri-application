import { Text } from '@/app/components/ui/typography';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme, type AppFormFieldTheme } from '@/app/components/form-field-theme';
import {
	CONFIGURATION_PATTERNS,
	configurationPattern,
	type ConfigurationPatternId
} from '@/lib/astrology/configurationPatterns';
import type { ConfigurationSearchRequest } from '@/lib/tauri/types';

interface ConfigurationSelectorProps {
	searches: ConfigurationSearchRequest[];
	onSearchesChange: (value: ConfigurationSearchRequest[]) => void;
}

function roleIsFixed(entry: ConfigurationSearchRequest, role: string): boolean {
	return (entry.fixedRoles ?? []).includes(role);
}

function toggleFixedRole(
	entry: ConfigurationSearchRequest,
	role: string,
	fixed: boolean
): ConfigurationSearchRequest {
	const current = entry.fixedRoles ?? [];
	const fixedRoles = fixed ? [...current, role] : current.filter((r) => r !== role);
	return { ...entry, fixedRoles };
}

function RoleToggle({
	ft,
	entry,
	role,
	onChange
}: {
	ft: AppFormFieldTheme;
	entry: ConfigurationSearchRequest;
	role: string;
	onChange: (entry: ConfigurationSearchRequest) => void;
}) {
	const { t } = useTranslation();
	const fixed = roleIsFixed(entry, role);
	return (
		<Label className="flex cursor-pointer items-center gap-2">
			<Checkbox
				checked={fixed}
				onCheckedChange={(checked) => onChange(toggleFixedRole(entry, role, checked === true))}
				className={cn('size-3.5', ft.checkboxAccent)}
			/>
			<Text variant="caption" as="span" tone="muted">
				{role}:{' '}
				{fixed
					? t('transits_configuration_role_fixed', { defaultValue: 'fixed (natal)' })
					: t('transits_configuration_role_moving', { defaultValue: 'moving' })}
			</Text>
		</Label>
	);
}

/** Pattern selection and per-role fixed/moving choices for `configurationRequests`
 *  (`exact_hits`/`station_events`'s sibling for multi-body configuration interval search).
 *  Role *candidates* are not narrowed here — every role defaults to the full transiting/transited
 *  selection from the Transiting/Transited Bodies tabs, per role's fixed/moving choice; narrowing
 *  an individual role to a smaller candidate set is a documented follow-up, not implemented here. */
export function ConfigurationSelector({ searches, onSearchesChange }: ConfigurationSelectorProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();

	const addSearch = () => {
		onSearchesChange([...searches, { configurationId: 'grand_trine', fixedRoles: [] }]);
	};
	const removeSearch = (index: number) => {
		onSearchesChange(searches.filter((_, i) => i !== index));
	};
	const updateSearch = (index: number, next: ConfigurationSearchRequest) => {
		onSearchesChange(searches.map((entry, i) => (i === index ? next : entry)));
	};

	return (
		<div className="space-y-3">
			{searches.map((entry, index) => {
				const pattern = configurationPattern(entry.configurationId);
				return (
					<div key={index} className={cn('space-y-2 rounded-lg border p-3', ft.advancedPanel)}>
						<div className="flex items-center justify-between gap-2">
							<Select
								value={entry.configurationId}
								onValueChange={(value) =>
									updateSearch(index, {
										configurationId: value as ConfigurationPatternId,
										fixedRoles: []
									})
								}
							>
								<SelectTrigger variant="form" className="h-8 w-48 text-xs shadow-inner">
									<SelectValue />
								</SelectTrigger>
								<SelectContent variant="form">
									{CONFIGURATION_PATTERNS.map((candidate) => (
										<SelectItem variant="form" key={candidate.id} value={candidate.id}>
											{t(candidate.labelKey, { defaultValue: candidate.id })}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								type="button"
								variant="ghost"
								className={cn('h-8 px-2 text-xs', ft.bodyText)}
								onClick={() => removeSearch(index)}
							>
								{t('transits_configuration_remove', { defaultValue: 'Remove' })}
							</Button>
						</div>
						{pattern && (
							<div className="flex flex-wrap gap-3 pl-1">
								{pattern.roles.map((role) => (
									<RoleToggle
										key={role}
										ft={ft}
										entry={entry}
										role={role}
										onChange={(next) => updateSearch(index, next)}
									/>
								))}
							</div>
						)}
					</div>
				);
			})}
			<Button
				type="button"
				variant="outline"
				className={cn('h-8 px-3 text-xs', ft.bodyText)}
				onClick={addSearch}
			>
				{t('transits_configuration_add', { defaultValue: '+ Add configuration search' })}
			</Button>
		</div>
	);
}
