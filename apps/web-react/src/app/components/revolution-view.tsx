import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppMainContentRoot } from './app-main-content';
import type { Theme } from './astrology-sidebar';
import { useAppFormFieldTheme } from './form-field-theme';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { cn } from './ui/utils';

type RevolutionKind = 'solar' | 'lunar' | 'relative';
type RevolutionScope = 'return' | 'quarters' | 'fraction';

const REVOLUTION_KINDS: RevolutionKind[] = ['solar', 'lunar', 'relative'];
const REVOLUTION_SCOPES: RevolutionScope[] = ['return', 'quarters', 'fraction'];

export function RevolutionView({ theme }: { theme: Theme }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const [kind, setKind] = useState<RevolutionKind>('solar');
	const [includeTransReturn, setIncludeTransReturn] = useState(false);
	const [scope, setScope] = useState<RevolutionScope>('return');
	const [fraction, setFraction] = useState('10');
	const [customPeriod, setCustomPeriod] = useState(false);
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');

	const calculate = () => {
		toast.success(t('revolution_submitted'), {
			description: t(`revolution_kind_${kind}`)
		});
	};

	return (
		<AppMainContentRoot className={ft.formPageBg}>
			<form
				className="mx-auto w-full max-w-[520px] py-5 md:py-10"
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
						<SelectTrigger className={cn(ft.selectTrigger, 'min-h-11 rounded-full')}>
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
						checked={includeTransReturn}
						onCheckedChange={setIncludeTransReturn}
						className={cn(
							'data-[state=checked]:bg-[color:var(--theme-accent)]',
							ft.switchUnchecked
						)}
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
						<Label htmlFor="revolution-period" className={cn('text-sm', ft.title)}>
							{t('revolution_set_period')}
						</Label>
						<Switch
							id="revolution-period"
							checked={customPeriod}
							onCheckedChange={setCustomPeriod}
							className={cn(
								'data-[state=checked]:bg-[color:var(--theme-accent)]',
								ft.switchUnchecked
							)}
						/>
					</div>
					<div
						className={cn(
							'grid overflow-hidden transition-all duration-200 sm:grid-cols-2 sm:gap-3',
							customPeriod ? 'mt-4 max-h-32 gap-3 opacity-100' : 'max-h-0 opacity-0'
						)}
						aria-hidden={!customPeriod}
					>
						<div>
							<Label
								htmlFor="revolution-date-from"
								className={cn('mb-2 text-xs uppercase', ft.muted)}
							>
								{t('revolution_date_from')}
							</Label>
							<Input
								id="revolution-date-from"
								type="date"
								value={dateFrom}
								onChange={(event) => setDateFrom(event.target.value)}
								className={ft.inputCompact}
								tabIndex={customPeriod ? 0 : -1}
							/>
						</div>
						<div>
							<Label
								htmlFor="revolution-date-to"
								className={cn('mb-2 text-xs uppercase', ft.muted)}
							>
								{t('revolution_date_to')}
							</Label>
							<Input
								id="revolution-date-to"
								type="date"
								value={dateTo}
								onChange={(event) => setDateTo(event.target.value)}
								className={ft.inputCompact}
								tabIndex={customPeriod ? 0 : -1}
							/>
						</div>
					</div>
				</section>

				<Button type="submit" className={cn(ft.footerPrimary, 'h-11 w-full')}>
					{t('revolution_calculate')}
				</Button>
			</form>
		</AppMainContentRoot>
	);
}
