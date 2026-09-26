import { useMemo, useState } from 'react';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import type { Theme } from './astrology-sidebar';
import { DatePickerInput } from './date-picker-input';
import { useAppFormFieldTheme } from './form-field-theme';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { ModeSwitcher, ModeSwitcherDetails } from './ui/mode-switcher';
import { cn } from './ui/utils';

type RevolutionKind = 'solar' | 'lunar' | 'relative';
type RevolutionScope = 'return' | 'quarters' | 'fraction';

const REVOLUTION_KINDS: RevolutionKind[] = ['solar', 'lunar', 'relative'];
const REVOLUTION_SCOPES: RevolutionScope[] = ['return', 'quarters', 'fraction'];

export function RevolutionView({ theme }: { theme: Theme }) {
	const { t, i18n } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const [kind, setKind] = useState<RevolutionKind>('solar');
	const [includeTransReturn, setIncludeTransReturn] = useState(false);
	const [scope, setScope] = useState<RevolutionScope>('return');
	const [fraction, setFraction] = useState('10');
	const [customPeriod, setCustomPeriod] = useState(false);
	const [dateFrom, setDateFrom] = useState<Date>(() => new Date());
	const [dateTo, setDateTo] = useState<Date>(() => new Date());

	const dateFnsLocale = useMemo(() => {
		const base = i18n.language.split('-')[0]?.toLowerCase() ?? 'en';
		if (base === 'cs') return cs;
		if (base === 'fr') return fr;
		if (base === 'es') return es;
		return enUS;
	}, [i18n.language]);

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
						<div className="space-y-4">
							{REVOLUTION_SCOPES.map((option) => (
								<label key={option} className="flex cursor-pointer items-center gap-3">
									<input
										type="radio"
										name="revolution-scope"
										value={option}
										checked={scope === option}
										onChange={() => setScope(option)}
										className="size-4 accent-[var(--theme-accent)]"
									/>
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
						</div>
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
								locale={dateFnsLocale}
								labelClassName={cn('mb-2 text-xs uppercase', ft.muted)}
								iconClassName={ft.iconColor}
								panelClassName={ft.datePicker}
							/>
							<DatePickerInput
								id="revolution-date-to"
								label={t('revolution_date_to')}
								value={dateTo}
								onValueChange={setDateTo}
								locale={dateFnsLocale}
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
