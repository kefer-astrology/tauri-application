import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/app/components/ui/accordion';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/app/components/ui/select';
import { Separator } from '@/app/components/ui/separator';
import { cn } from '@/app/components/ui/utils';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/ui/app-main-content';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import {
	buildSynastryChart,
	emptyPerson,
	isPersonReady,
	isProgressedCalculationType,
	isSupportedCalculationType,
	SYNASTRY_CALCULATION_TYPES,
	todayInputValue,
	type SynastryCalculationType,
	type SynastryPerson
} from '@/lib/synastryForm';
import type { AppChart } from '@/lib/tauri/chartPayload';
import { PersonFields } from './person-fields';

const OPEN_SECTIONS = ['person-a', 'person-b'];

/** One person in its own accordion section. */
function PersonSection({
	id,
	title,
	person,
	onChange
}: {
	id: string;
	title: string;
	person: SynastryPerson;
	onChange: (person: SynastryPerson) => void;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<Accordion type="multiple" defaultValue={OPEN_SECTIONS} className="w-full">
			<AccordionItem value={id} className="border-[color:var(--theme-panel-border)]">
				<AccordionTrigger className={cn('text-base hover:no-underline', ft.title)}>
					<span>{title}</span>
				</AccordionTrigger>
				<AccordionContent className="pb-5">
					<PersonFields person={person} onChange={onChange} personLabel={id} />
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

/** Create a relationship analysis between two people (synastry and its variants). */
export function SynastryView({ onCreated }: { onCreated?: (chart: AppChart) => void }) {
	const { t } = useTranslation();
	const { charts, selectedChartId } = useWorkspaceCharts();
	const ft = useAppFormFieldTheme();
	const [name, setName] = useState('');
	const [personA, setPersonA] = useState(() => emptyPerson(new Date(), selectedChartId ?? ''));
	const [personB, setPersonB] = useState(() =>
		emptyPerson(new Date(), charts.find((chart) => chart.id !== selectedChartId)?.id ?? '')
	);
	const [calculationType, setCalculationType] = useState<SynastryCalculationType>('synastry');
	const [progressionDate, setProgressionDate] = useState(() => todayInputValue());
	const ready = isPersonReady(personA) && isPersonReady(personB);
	const progressed = isProgressedCalculationType(calculationType);
	const supported = isSupportedCalculationType(calculationType);
	const sectionLabel = cn('mb-2 text-xs tracking-[0.08em] uppercase', ft.muted);

	return (
		<AppMainContentRoot className={ft.formPageBg}>
			<AppMainContentContainer width="standard">
				<form
					className="w-full py-2 pb-16 md:py-6"
					onSubmit={(event) => {
						event.preventDefault();
						if (!supported || !ready) return;
						onCreated?.(
							buildSynastryChart({
								name,
								personA,
								personB,
								calculationType,
								progressionDate,
								charts,
								personLabels: { a: t('synastry_person_a'), b: t('synastry_person_b') }
							})
						);
						toast.success(t('synastry_submitted'), {
							description: t(`synastry_type_${calculationType}`)
						});
					}}
				>
					<div className="mb-7">
						<Label htmlFor="synastry-name" className={sectionLabel}>
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

					<section className="mb-7">
						<Label className={sectionLabel}>{t('synastry_type_label')}</Label>
						<Select
							value={calculationType}
							onValueChange={(value) => setCalculationType(value as SynastryCalculationType)}
						>
							<SelectTrigger className={cn(ft.selectTrigger, 'rounded-full')}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent className={cn(ft.selectContent, 'max-h-[420px]')}>
								{SYNASTRY_CALCULATION_TYPES.map((type) => (
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
						{!supported && (
							<p className={cn('mt-2 text-xs', ft.muted)}>
								{t('synastry_type_not_implemented_notice')}
							</p>
						)}
					</section>

					<PersonSection
						id="person-a"
						title={t('synastry_person_a')}
						person={personA}
						onChange={setPersonA}
					/>

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

					<PersonSection
						id="person-b"
						title={t('synastry_person_b')}
						person={personB}
						onChange={setPersonB}
					/>

					<div
						className={cn(
							'overflow-hidden transition-all duration-300',
							progressed ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
						)}
						aria-hidden={!progressed}
					>
						<Separator className="bg-[color:var(--theme-panel-border)]" />
						<div className="py-5">
							<Label htmlFor="progression-date" className={sectionLabel}>
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
									className={cn(
										ft.iconColor,
										'justify-start hover:bg-[color:var(--theme-soft-bg)]'
									)}
								>
									{t('synastry_today')}
								</Button>
							</div>
						</div>
					</div>

					<Button
						type="submit"
						disabled={!ready || !supported}
						className={cn(ft.footerPrimary, 'mt-6 w-full rounded-full text-base')}
					>
						{t('synastry_create')}
					</Button>
				</form>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
