import { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppMainContentRoot } from './app-main-content';
import type { Theme } from './astrology-sidebar';
import { useAppFormFieldTheme } from './form-field-theme';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { cn } from './ui/utils';

type PersonMode = 'database' | 'manual';
type Person = {
	mode: PersonMode;
	chartId: string;
	date: string;
	time: string;
	location: string;
};

type CalculationType =
	| 'synastry'
	| 'composite'
	| 'davison'
	| 'coalescent'
	| 'progressed-synastry'
	| 'progressed-composite'
	| 'draconic-synastry';

const CALCULATION_TYPES: CalculationType[] = [
	'synastry',
	'composite',
	'davison',
	'coalescent',
	'progressed-synastry',
	'progressed-composite',
	'draconic-synastry'
];

function emptyPerson(): Person {
	return { mode: 'database', chartId: '', date: '', time: '', location: '' };
}

function todayInputValue(): string {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function PersonFields({
	person,
	onChange,
	theme,
	personLabel
}: {
	person: Person;
	onChange: (person: Person) => void;
	theme: Theme;
	personLabel: string;
}) {
	const { t } = useTranslation();
	const { charts } = useWorkspaceCharts();
	const ft = useAppFormFieldTheme(theme);
	const manual = person.mode === 'manual';
	const set = <K extends keyof Person>(key: K, value: Person[K]) =>
		onChange({ ...person, [key]: value });

	return (
		<div className="space-y-4">
			<div>
				<Label className={cn('mb-2 text-xs tracking-[0.08em] uppercase', ft.muted)}>
					{t('synastry_chart')}
				</Label>
				<Select
					value={person.chartId}
					onValueChange={(value) => set('chartId', value)}
					disabled={manual || charts.length === 0}
				>
					<SelectTrigger className={cn(ft.selectTrigger, 'min-h-11')} aria-label={personLabel}>
						<SelectValue
							placeholder={charts.length ? t('synastry_choose_chart') : t('synastry_no_charts')}
						/>
					</SelectTrigger>
					<SelectContent className={ft.selectContent}>
						{charts.map((chart) => (
							<SelectItem key={chart.id} value={chart.id} className={ft.selectItem}>
								<span className="flex min-w-0 flex-col">
									<span className="truncate">{chart.name}</span>
									<span className={cn('truncate text-xs', ft.muted)}>
										{chart.dateTime} · {chart.location}
									</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center gap-3">
				<span className={cn('text-sm font-medium', !manual ? ft.iconColor : ft.muted)}>
					{t('synastry_from_database')}
				</span>
				<Switch
					checked={manual}
					onCheckedChange={(checked) => set('mode', checked ? 'manual' : 'database')}
					aria-label={t('synastry_manual_toggle')}
					className={cn('data-[state=checked]:bg-[color:var(--theme-accent)]', ft.switchUnchecked)}
				/>
				<span className={cn('text-sm font-medium', manual ? ft.iconColor : ft.muted)}>
					{t('synastry_manual')}
				</span>
			</div>

			<div
				className={cn(
					'grid overflow-hidden transition-all duration-300',
					manual ? 'max-h-80 gap-4 opacity-100' : 'max-h-0 opacity-0'
				)}
				aria-hidden={!manual}
			>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<Label
							className={cn('mb-2 text-xs tracking-[0.08em] uppercase', ft.muted)}
							htmlFor={`${personLabel}-date`}
						>
							{t('synastry_date')}
						</Label>
						<Input
							id={`${personLabel}-date`}
							type="date"
							value={person.date}
							onChange={(event) => set('date', event.target.value)}
							className={ft.input}
							tabIndex={manual ? 0 : -1}
						/>
					</div>
					<div>
						<Label
							className={cn('mb-2 text-xs tracking-[0.08em] uppercase', ft.muted)}
							htmlFor={`${personLabel}-time`}
						>
							{t('synastry_time')}
						</Label>
						<Input
							id={`${personLabel}-time`}
							type="time"
							step="1"
							value={person.time}
							onChange={(event) => set('time', event.target.value)}
							className={ft.input}
							tabIndex={manual ? 0 : -1}
						/>
					</div>
				</div>
				<div>
					<Label
						className={cn('mb-2 text-xs tracking-[0.08em] uppercase', ft.muted)}
						htmlFor={`${personLabel}-location`}
					>
						{t('synastry_location')}
					</Label>
					<Input
						id={`${personLabel}-location`}
						value={person.location}
						onChange={(event) => set('location', event.target.value)}
						placeholder={t('synastry_location_placeholder')}
						className={ft.input}
						tabIndex={manual ? 0 : -1}
					/>
				</div>
			</div>
		</div>
	);
}

function isPersonReady(person: Person): boolean {
	return person.mode === 'database'
		? Boolean(person.chartId)
		: Boolean(person.date && person.time && person.location.trim());
}

export function SynastryView({ theme }: { theme: Theme }) {
	const { t } = useTranslation();
	const { charts, selectedChartId } = useWorkspaceCharts();
	const ft = useAppFormFieldTheme(theme);
	const [name, setName] = useState('');
	const [personA, setPersonA] = useState<Person>(() => ({
		...emptyPerson(),
		chartId: selectedChartId ?? ''
	}));
	const [personB, setPersonB] = useState<Person>(() => ({
		...emptyPerson(),
		chartId: charts.find((chart) => chart.id !== selectedChartId)?.id ?? ''
	}));
	const [calculationType, setCalculationType] = useState<CalculationType>('synastry');
	const [progressionDate, setProgressionDate] = useState(todayInputValue);
	const ready = isPersonReady(personA) && isPersonReady(personB);
	const progressed =
		calculationType === 'progressed-synastry' || calculationType === 'progressed-composite';
	const openSections = useMemo(() => ['person-a', 'person-b'], []);

	return (
		<AppMainContentRoot className={ft.formPageBg}>
			<form
				className="mx-auto w-full max-w-[920px] py-2 pb-16 md:py-6"
				onSubmit={(event) => {
					event.preventDefault();
					toast.success(t('synastry_submitted'), {
						description: t(`synastry_type_${calculationType}`)
					});
				}}
			>
				<div className="mb-7">
					<Label
						htmlFor="synastry-name"
						className={cn('mb-2 text-xs tracking-[0.08em] uppercase', ft.muted)}
					>
						{t('synastry_name')}
					</Label>
					<Input
						id="synastry-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder={t('synastry_name_placeholder')}
						className={ft.input}
					/>
				</div>

				<Accordion type="multiple" defaultValue={openSections} className="w-full">
					<AccordionItem value="person-a" className="border-[color:var(--theme-panel-border)]">
						<AccordionTrigger className={cn('text-base hover:no-underline', ft.title)}>
							<span>{t('synastry_person_a')}</span>
						</AccordionTrigger>
						<AccordionContent className="pb-5">
							<PersonFields
								person={personA}
								onChange={setPersonA}
								theme={theme}
								personLabel="person-a"
							/>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				<div className="flex justify-center py-3">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							setPersonA(personB);
							setPersonB(personA);
						}}
						className={cn(
							ft.muted,
							'hover:bg-[color:var(--theme-soft-bg)] hover:text-[color:var(--theme-accent)]'
						)}
					>
						<ArrowLeftRight /> {t('synastry_swap')}
					</Button>
				</div>

				<Accordion type="multiple" defaultValue={openSections} className="w-full">
					<AccordionItem value="person-b" className="border-[color:var(--theme-panel-border)]">
						<AccordionTrigger className={cn('text-base hover:no-underline', ft.title)}>
							<span>{t('synastry_person_b')}</span>
						</AccordionTrigger>
						<AccordionContent className="pb-5">
							<PersonFields
								person={personB}
								onChange={setPersonB}
								theme={theme}
								personLabel="person-b"
							/>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				<section className="py-5">
					<Label className={cn('mb-2 text-sm font-semibold', ft.iconColor)}>
						{t('synastry_type_label')}
					</Label>
					<Select
						value={calculationType}
						onValueChange={(value) => setCalculationType(value as CalculationType)}
					>
						<SelectTrigger className={cn(ft.selectTrigger, 'min-h-12 rounded-full')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={cn(ft.selectContent, 'max-h-[420px]')}>
							{CALCULATION_TYPES.map((type) => (
								<SelectItem key={type} value={type} className={cn(ft.selectItem, 'py-2.5')}>
									<span className="flex flex-col items-start">
										<span className="font-medium">{t(`synastry_type_${type}`)}</span>
										<span className={cn('text-xs font-normal', ft.muted)}>
											{t(`synastry_type_${type}_description`)}
										</span>
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</section>

				<div
					className={cn(
						'overflow-hidden transition-all duration-300',
						progressed ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
					)}
					aria-hidden={!progressed}
				>
					<Separator className="bg-[color:var(--theme-panel-border)]" />
					<div className="py-5">
						<Label
							htmlFor="progression-date"
							className={cn('mb-2 text-sm font-semibold', ft.iconColor)}
						>
							{t('synastry_progression_date')}
						</Label>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<Input
								id="progression-date"
								type="date"
								value={progressionDate}
								onChange={(event) => setProgressionDate(event.target.value)}
								className={cn(ft.input, 'sm:max-w-xs')}
								tabIndex={progressed ? 0 : -1}
							/>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setProgressionDate(todayInputValue())}
								className={cn(ft.iconColor, 'justify-start hover:bg-[color:var(--theme-soft-bg)]')}
							>
								{t('synastry_today')}
							</Button>
						</div>
					</div>
				</div>

				<Button
					type="submit"
					disabled={!ready}
					className={cn(ft.footerPrimary, 'mt-6 h-12 w-full rounded-full text-base')}
				>
					{t('synastry_create')}
				</Button>
			</form>
		</AppMainContentRoot>
	);
}
