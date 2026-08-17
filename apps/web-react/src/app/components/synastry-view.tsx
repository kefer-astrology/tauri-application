import { useMemo, useState } from 'react';
import { cs, enUS, es, fr } from 'date-fns/locale';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppMainContentRoot } from './app-main-content';
import type { Theme } from './astrology-sidebar';
import { useAppFormFieldTheme } from './form-field-theme';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Button } from './ui/button';
import { DatePickerInput } from './date-picker-input';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LocationSelector } from './location-selector';
import { ModeSwitcher } from './mode-switcher';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { TimeRollerPicker } from './time-roller-picker';
import { cn } from './ui/utils';
import { searchLocations } from '@/lib/tauri/workspace';

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
	const now = new Date();
	return {
		mode: 'database',
		chartId: '',
		date: localDateValue(now),
		time: localTimeValue(now),
		location: ''
	};
}

function todayInputValue(): string {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function localDateValue(value: Date): string {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function localTimeValue(value: Date): string {
	const hours = String(value.getHours()).padStart(2, '0');
	const minutes = String(value.getMinutes()).padStart(2, '0');
	const seconds = String(value.getSeconds()).padStart(2, '0');
	return `${hours}:${minutes}:${seconds}`;
}

function personDateTime(person: Person): Date {
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(person.date);
	const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(person.time);
	if (!dateMatch || !timeMatch) return new Date();
	return new Date(
		Number(dateMatch[1]),
		Number(dateMatch[2]) - 1,
		Number(dateMatch[3]),
		Number(timeMatch[1]),
		Number(timeMatch[2]),
		Number(timeMatch[3] ?? 0)
	);
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
	const { t, i18n } = useTranslation();
	const { charts } = useWorkspaceCharts();
	const ft = useAppFormFieldTheme(theme);
	const manual = person.mode === 'manual';
	const dateTime = useMemo(() => personDateTime(person), [person.date, person.time]);
	const dateFnsLocale = useMemo(() => {
		const language = i18n.language.split('-')[0]?.toLowerCase() ?? 'en';
		if (language === 'cs') return cs;
		if (language === 'fr') return fr;
		if (language === 'es') return es;
		return enUS;
	}, [i18n.language]);
	const locationOptions = useMemo(
		() => charts.map((chart) => chart.location).filter(Boolean),
		[charts]
	);
	const set = <K extends keyof Person>(key: K, value: Person[K]) =>
		onChange({ ...person, [key]: value });

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="sm:col-span-2">
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

				<div>
					<Label className={cn('mb-2 text-xs tracking-[0.08em] uppercase', ft.muted)}>
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
						listClassName="h-11"
					/>
				</div>
			</div>

			<div
				className={cn(
					'grid overflow-hidden transition-all duration-300',
					manual ? 'max-h-80 gap-4 opacity-100' : 'max-h-0 opacity-0'
				)}
				aria-hidden={!manual}
			>
				<div className={cn('space-y-3', ft.advancedPanel)}>
					<div className="grid gap-3 sm:grid-cols-2">
						<DatePickerInput
							id={`${personLabel}-date`}
							label={t('synastry_date')}
							value={dateTime}
							onValueChange={(value) => set('date', localDateValue(value))}
							locale={dateFnsLocale}
							labelClassName={ft.label}
							iconClassName={ft.iconColor}
							panelClassName={ft.datePicker}
						/>
						<TimeRollerPicker
							id={`${personLabel}-time`}
							label={t('synastry_time')}
							value={dateTime}
							onValueChange={(value) => set('time', localTimeValue(value))}
							labelClassName={ft.label}
							iconClassName={ft.iconColor}
							panelClassName={ft.selectContent}
						/>
					</div>
					<div>
						<Label className={cn('mb-1.5 block', ft.label)} htmlFor={`${personLabel}-location`}>
							{t('synastry_location')}
						</Label>
						<LocationSelector
							id={`${personLabel}-location`}
							value={person.location}
							onValueChange={(value) => set('location', value)}
							options={locationOptions}
							placeholder={t('synastry_location_placeholder')}
							searchPlaceholder={t('new_location_search')}
							emptyLabel={t('synastry_location_placeholder')}
							loadingLabel={t('new_resolving_location')}
							searchLocations={searchLocations}
							className={ft.input}
							iconClassName={ft.iconColor}
						/>
					</div>
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
