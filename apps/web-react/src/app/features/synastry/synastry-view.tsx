import { Text } from '@/app/components/ui/typography';
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
						<Label htmlFor="synastry-name" variant="eyebrow" tone="muted" className="mb-2">
							{t('synastry_name')}
						</Label>
						<Input
							variant="form"
							id="synastry-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder={t('synastry_name_placeholder')}
						/>
					</div>

					<section className="mb-7">
						<Label variant="eyebrow" tone="muted" className="mb-2">
							{t('synastry_type_label')}
						</Label>
						<Select
							value={calculationType}
							onValueChange={(value) => setCalculationType(value as SynastryCalculationType)}
						>
							<SelectTrigger variant="form" className="rounded-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent variant="form" className="max-h-[420px]">
								{SYNASTRY_CALCULATION_TYPES.map((type) => (
									<SelectItem variant="form" key={type} value={type} className="py-2.5">
										<span className="flex flex-col items-start">
											<span className="font-medium">{t(`synastry_type_${type}`)}</span>
											<Text variant="caption" as="span" tone="muted" className="font-normal">
												{t(`synastry_type_${type}_description`)}
											</Text>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{!supported && (
							<Text variant="caption" tone="muted" className="mt-2">
								{t('synastry_type_not_implemented_notice')}
							</Text>
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
								'hover:bg-[color:var(--theme-hover-bg)] hover:text-[color:var(--theme-accent)]'
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
							<Label htmlFor="progression-date" variant="eyebrow" tone="muted" className="mb-2">
								{t('synastry_progression_date')}
							</Label>
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
								<Input
									variant="form"
									id="progression-date"
									type="date"
									value={progressionDate}
									onChange={(event) => setProgressionDate(event.target.value)}
									className="sm:max-w-xs"
									tabIndex={progressed ? 0 : -1}
								/>
								<Button
									type="button"
									variant="ghost"
									onClick={() => setProgressionDate(todayInputValue())}
									className={cn(
										ft.iconColor,
										'justify-start hover:bg-[color:var(--theme-hover-bg)]'
									)}
								>
									{t('synastry_today')}
								</Button>
							</div>
						</div>
					</div>

					<Button
						variant="form-primary"
						size="form"
						type="submit"
						disabled={!ready || !supported}
						className="mt-6 w-full flex-1 rounded-full text-base"
					>
						{t('synastry_create')}
					</Button>
				</form>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
