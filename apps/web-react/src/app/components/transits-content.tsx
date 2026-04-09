import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from './ui/utils';
import { getAppFormFieldTheme } from './form-field-theme';
import type { TransitSection } from './transits-secondary-sidebar';
import { TransitsBodiesConfig } from './transits-bodies-config';
import type { Theme } from './astrology-sidebar';

interface TransitsContentProps {
	section: TransitSection;
	theme: Theme;
}

type DropdownOption = { id: string; label: string };

type FormFieldTheme = ReturnType<typeof getAppFormFieldTheme>;

interface CustomDropdownProps {
	label: string;
	value: string;
	options: DropdownOption[];
	onChange: (id: string) => void;
	ft: FormFieldTheme;
}

function CustomDropdown({ label, value, options, onChange, ft }: CustomDropdownProps) {
	const [isOpen, setIsOpen] = React.useState(false);
	const dropdownRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const selectedLabel = options.find((o) => o.id === value)?.label ?? value;
	const isDark = ft.isDark || ft.isTwilight;

	return (
		<div className="mb-6" ref={dropdownRef}>
			<Label className={cn('mb-2 block', ft.label)}>{label}</Label>

			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					ft.selectTrigger,
					'shadow-inner',
					'focus:ring-2 focus:ring-blue-500 focus:outline-none'
				)}
			>
				<span className="text-sm">{selectedLabel}</span>
				<ChevronDown
					className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')}
				/>
			</button>

			{isOpen && (
				<div
					className={cn(
						'animate-dropdown-slide-in mt-2 overflow-hidden rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/10',
						ft.dropdown,
						'border-0'
					)}
				>
					{options.map((option, index) => (
						<button
							key={option.id}
							type="button"
							onClick={() => {
								onChange(option.id);
								setIsOpen(false);
							}}
							className={cn(
								'w-full px-4 py-2.5 text-left text-sm transition-colors duration-150',
								value === option.id ? ft.dropdownActive : cn(ft.dropdownHover, 'text-left'),
								index > 0 && 'border-t',
								isDark && index > 0 ? 'border-blue-900/40' : 'border-gray-100'
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

const MAJOR_ASPECT_ROWS: { labelKey: string; glyph: string; angle: string; orb: string }[] = [
	{ labelKey: 'aspect_conjunction', glyph: '☌', angle: '0°', orb: '8°' },
	{ labelKey: 'aspect_opposition', glyph: '☍', angle: '180°', orb: '8°' },
	{ labelKey: 'aspect_trine', glyph: '△', angle: '120°', orb: '8°' },
	{ labelKey: 'aspect_square', glyph: '□', angle: '90°', orb: '8°' },
	{ labelKey: 'aspect_sextile', glyph: '⚹', angle: '60°', orb: '6°' }
];

const MINOR_ASPECT_ROWS: { labelKey: string; angle: string; orb: string }[] = [
	{ labelKey: 'aspect_quincunx', angle: '150°', orb: '3°' },
	{ labelKey: 'transits_aspects_semisextile', angle: '30°', orb: '3°' },
	{ labelKey: 'transits_aspects_semisquare', angle: '45°', orb: '3°' },
	{ labelKey: 'transits_aspects_sesqui', angle: '135°', orb: '3°' }
];

export function TransitsContent({ section, theme }: TransitsContentProps) {
	const { t } = useTranslation();
	const ft = useMemo(() => getAppFormFieldTheme(theme), [theme]);

	const [selectedTypeId, setSelectedTypeId] = React.useState('transit');
	const [periodModeId, setPeriodModeId] = React.useState('current');
	const [checkboxes, setCheckboxes] = React.useState({
		houseTransitions: false,
		signTransitions: false,
		transitLimits: false,
		precessionCorrection: false
	});

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
	const areCheckboxesDisabled = periodModeId === 'current';

	const renderContent = () => {
		switch (section) {
			case 'general':
				return (
					<div className="flex h-full items-center justify-center p-8">
						<div
							className={cn(
								'w-full max-w-3xl rounded-xl p-8',
								ft.settingsCard,
								'border-0 shadow-none'
							)}
						>
							<div className="mb-6">
								<h1 className={cn('mb-2 text-2xl font-semibold', ft.title)}>
									{t('transits_heading_general')}
								</h1>
								<p className={cn('text-sm', ft.muted)}>{t('transits_subtitle_general')}</p>
							</div>

							<CustomDropdown
								label={t('transits_label_type')}
								value={selectedTypeId}
								options={typeOptions}
								onChange={setSelectedTypeId}
								ft={ft}
							/>

							<CustomDropdown
								label={t('transits_label_period')}
								value={periodModeId}
								options={periodOptions}
								onChange={setPeriodModeId}
								ft={ft}
							/>

							<div className="mb-6 grid grid-cols-2 gap-4">
								<div className="space-y-3">
									<label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<input
											type="checkbox"
											checked={checkboxes.houseTransitions}
											onChange={(e) =>
												setCheckboxes({ ...checkboxes, houseTransitions: e.target.checked })
											}
											className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
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
									</label>
									<label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<input
											type="checkbox"
											checked={checkboxes.signTransitions}
											onChange={(e) =>
												setCheckboxes({ ...checkboxes, signTransitions: e.target.checked })
											}
											className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
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
									</label>
								</div>
								<div className="space-y-3">
									<label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<input
											type="checkbox"
											checked={checkboxes.transitLimits}
											onChange={(e) =>
												setCheckboxes({ ...checkboxes, transitLimits: e.target.checked })
											}
											className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
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
									</label>
									<label
										className={cn(
											'flex items-start gap-3',
											areCheckboxesDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
										)}
									>
										<input
											type="checkbox"
											checked={checkboxes.precessionCorrection}
											onChange={(e) =>
												setCheckboxes({ ...checkboxes, precessionCorrection: e.target.checked })
											}
											className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
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
									</label>
								</div>
							</div>

							<div className="mb-4">
								<Label className={cn('mb-2 block', ft.label)}>{t('transits_period_from')}:</Label>
								<div className="grid grid-cols-3 gap-3">
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_date')}
										</Label>
										<Input
											type="date"
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
											disabled={isPeriodDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												isPeriodDisabled && ft.inputDisabled
											)}
										/>
									</div>
								</div>
							</div>

							<div className="mb-8">
								<Label className={cn('mb-2 block', ft.label)}>{t('transits_period_to')}:</Label>
								<div className="grid grid-cols-3 gap-3">
									<div>
										<Label className={cn('mb-1 block text-xs', ft.muted)}>
											{t('transits_general_item_date')}
										</Label>
										<Input
											type="date"
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
											disabled={isPeriodDisabled}
											className={cn(
												ft.input,
												'h-10 py-2 text-sm shadow-inner',
												isPeriodDisabled && ft.inputDisabled
											)}
										/>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-center gap-4 pt-6">
								<button type="button" className={cn(ft.footerCancel, '!flex-none')}>
									{t('button_close')}
								</button>
								<button type="button" className={cn(ft.footerPrimary, '!flex-none')}>
									{t('button_ok')}
								</button>
							</div>
						</div>
					</div>
				);

			case 'transiting-bodies':
				return (
					<TransitsBodiesConfig
						theme={theme}
						titleKey="transits_heading_transiting"
						subtitleKey="transits_subtitle_transiting"
					/>
				);

			case 'transited-bodies':
				return (
					<TransitsBodiesConfig
						theme={theme}
						titleKey="transits_heading_transited"
						subtitleKey="transits_subtitle_transited"
					/>
				);

			case 'aspects':
				return (
					<div className="space-y-6">
						<div>
							<h1 className={cn('mb-2 text-2xl font-semibold', ft.title)}>
								{t('transits_menu_aspects_used')}
							</h1>
							<p className={cn('text-sm', ft.muted)}>{t('transits_aspects_subtitle')}</p>
						</div>

						<div className={cn('rounded-xl p-6', ft.settingsCard, 'border-0 shadow-none')}>
							<h3 className={cn('mb-4 text-lg font-semibold', ft.title)}>
								{t('transits_aspects_major')}
							</h3>
							<div className="space-y-4">
								{MAJOR_ASPECT_ROWS.map((aspect) => (
									<div key={aspect.labelKey} className="flex items-center gap-4">
										<label className="flex flex-1 cursor-pointer items-center gap-3">
											<input
												type="checkbox"
												className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
												defaultChecked
											/>
											<span className={cn('text-sm font-medium', ft.bodyText)}>
												{t(aspect.labelKey)} {aspect.glyph}
											</span>
											<span className={cn('text-xs', ft.muted)}>{aspect.angle}</span>
										</label>
										<div className="flex items-center gap-2">
											<span className={cn('text-xs', ft.label)}>{t('label_orb')}:</span>
											<Input
												type="text"
												defaultValue={aspect.orb}
												className={cn(ft.inputCompact, 'h-9 w-16')}
											/>
										</div>
									</div>
								))}
							</div>
						</div>

						<div className={cn('rounded-xl p-6', ft.settingsCard, 'border-0 shadow-none')}>
							<h3 className={cn('mb-4 text-lg font-semibold', ft.title)}>
								{t('transits_aspects_minor')}
							</h3>
							<div className="space-y-4">
								{MINOR_ASPECT_ROWS.map((aspect) => (
									<div key={aspect.labelKey} className="flex items-center gap-4">
										<label className="flex flex-1 cursor-pointer items-center gap-3">
											<input
												type="checkbox"
												className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
											/>
											<span className={cn('text-sm font-medium', ft.bodyText)}>
												{t(aspect.labelKey)}
											</span>
											<span className={cn('text-xs', ft.muted)}>{aspect.angle}</span>
										</label>
										<div className="flex items-center gap-2">
											<span className={cn('text-xs', ft.label)}>{t('label_orb')}:</span>
											<Input
												type="text"
												defaultValue={aspect.orb}
												className={cn(ft.inputCompact, 'h-9 w-16')}
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				);
		}
	};

	const isWideBodiesSection = section === 'transiting-bodies' || section === 'transited-bodies';

	return (
		<div className="flex-1 overflow-auto">
			<div className={isWideBodiesSection ? 'p-8' : 'max-w-4xl p-8'}>{renderContent()}</div>
		</div>
	);
}
