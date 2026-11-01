import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ModeSwitcher, ModeSwitcherDetails } from '@/app/components/ui/mode-switcher';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { Separator } from '@/app/components/ui/separator';
import { Switch } from '@/app/components/ui/switch';
import { cn } from '@/app/components/ui/utils';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/ui/app-main-content';
import { DatePickerInput } from '@/app/components/ui/date-picker-input';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { dateFnsLocale } from '@/lib/time/dateFnsLocale';

type RevolutionKind = 'solar' | 'lunar' | 'relative';
type RevolutionScope = 'return' | 'quarters' | 'fraction';

const REVOLUTION_KINDS: RevolutionKind[] = ['solar', 'lunar', 'relative'];
const REVOLUTION_SCOPES: RevolutionScope[] = ['return', 'quarters', 'fraction'];

/** Solar, lunar or relative return setup (the calculation itself is not available yet). */
export function RevolutionView() {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme();
	const [kind, setKind] = useState<RevolutionKind>('solar');
	const [includeTransReturn, setIncludeTransReturn] = useState(false);
	const [scope, setScope] = useState<RevolutionScope>('return');
	const [fraction, setFraction] = useState('10');
	const [customPeriod, setCustomPeriod] = useState(false);
	const [dateFrom, setDateFrom] = useState<Date>(() => new Date());
	const [dateTo, setDateTo] = useState<Date>(() => new Date());

	const locale = useMemo(() => dateFnsLocale(i18n.language), [i18n.language]);

	const calculate = () => {
		toast.success(t('revolution_submitted'), {
			description: t(`revolution_kind_${kind}`)
		});
	};

	return (
		<AppMainContentRoot className={ft.formPageBg}>
			<AppMainContentContainer width="wide">
				<form
					className="w-full py-5 md:py-10"
					onSubmit={(event) => {
						event.preventDefault();
						calculate();
					}}
				>
					<section>
						<Label className={cn('mb-3 text-xs tracking-[0.08em] uppercase', ft.muted)}>
							{t('revolution_kind_label')}
						</Label>
						<Select value={kind} onValueChange={(value) => setKind(value as RevolutionKind)}>
							<SelectTrigger className={cn(ft.selectTrigger, 'rounded-full')}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent className={ft.selectContent}>
								{REVOLUTION_KINDS.map((option) => (
									<SelectItem key={option} value={option} className={ft.selectItem}>
										{t(`revolution_kind_${option}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</section>

					<Separator className="my-6 bg-[color:var(--theme-panel-border)]" />

					<section className="flex items-center justify-between gap-4">
						<Label htmlFor="trans-revolution" className={cn('text-sm', ft.title)}>
							{t('revolution_trans_return')}
						</Label>
						<Switch
							id="trans-revolution"
							variant="prominent"
							checked={includeTransReturn}
							onCheckedChange={setIncludeTransReturn}
						/>
					</section>

					<Separator className="my-6 bg-[color:var(--theme-panel-border)]" />

					<fieldset>
						<legend className={cn('mb-4 text-xs tracking-[0.08em] uppercase', ft.muted)}>
							{t('revolution_scope_label')}
						</legend>
						<RadioGroup
							name="revolution-scope"
							value={scope}
							onValueChange={(value) => setScope(value as RevolutionScope)}
							className="space-y-4"
						>
							{REVOLUTION_SCOPES.map((option) => (
								<label key={option} className="flex cursor-pointer items-center gap-3">
									<RadioGroupItem value={option} />
									<span className={cn('text-sm', scope === option ? ft.title : ft.muted)}>
										{t(`revolution_scope_${option}`)}
									</span>
									{option === 'fraction' ? (
										<span
											className={cn(
												'ml-1 flex items-center gap-1.5 text-sm transition-opacity',
												scope !== 'fraction' && 'pointer-events-none opacity-35'
											)}
										>
											<span>1</span>
											<span className={ft.muted}>/</span>
											<Input
												aria-label={t('revolution_fraction_denominator')}
												inputMode="numeric"
												value={fraction}
												onChange={(event) => setFraction(event.target.value.replace(/\D/g, ''))}
												disabled={scope !== 'fraction'}
												className={cn(ft.inputCompact, 'w-12 px-1 text-center')}
											/>
										</span>
									) : null}
								</label>
							))}
						</RadioGroup>
					</fieldset>

					<Separator className="my-6 bg-[color:var(--theme-panel-border)]" />

					<section className="mb-9">
						<div className="flex items-center justify-between gap-4">
							<Label className={cn('text-sm', ft.title)}>{t('revolution_set_period')}</Label>
							<ModeSwitcher
								value={customPeriod ? 'custom' : 'current'}
								onValueChange={(value) => setCustomPeriod(value === 'custom')}
								ariaLabel={t('revolution_set_period')}
								options={[
									{ value: 'current', label: t('transits_period_current') },
									{ value: 'custom', label: t('transits_period_custom') }
								]}
							/>
						</div>
						<ModeSwitcherDetails
							open={customPeriod}
							contentClassName="grid gap-3 pt-4 sm:grid-cols-2"
						>
							<DatePickerInput
								id="revolution-date-from"
								label={t('revolution_date_from')}
								value={dateFrom}
								onValueChange={setDateFrom}
								locale={locale}
								labelClassName={cn('mb-2 text-xs uppercase', ft.muted)}
								iconClassName={ft.iconColor}
								panelClassName={ft.datePicker}
							/>
							<DatePickerInput
								id="revolution-date-to"
								label={t('revolution_date_to')}
								value={dateTo}
								onValueChange={setDateTo}
								locale={locale}
								labelClassName={cn('mb-2 text-xs uppercase', ft.muted)}
								iconClassName={ft.iconColor}
								panelClassName={ft.datePicker}
							/>
						</ModeSwitcherDetails>
					</section>

					<Button type="submit" className={cn(ft.footerPrimary, 'w-full')}>
						{t('revolution_calculate')}
					</Button>
				</form>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
