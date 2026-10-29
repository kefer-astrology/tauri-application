import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Accordion } from '@/app/components/ui/accordion';
import { FilterSection } from '@/app/views/data/filter-controls';
import type { ChartQuery } from '@/lib/astrology/chartQuery';
import type { FactFilters } from '@/lib/astrology/factFilters';
import {
	AspectFilters,
	CatalogFilter,
	ChartTypeFilter,
	DateFilter,
	HouseFilters,
	LocationFilter,
	PlanetFilters,
	TagFilter
} from './chart-filter-sections';
import {
	AngularPlanetFilter,
	AspectDominanceFilters,
	ChartRulerFilter,
	DispositorFilter,
	ElementFilters,
	HemisphereFilters,
	HorizonFilter,
	HouseGroupFilters,
	InnerPlanetFilters,
	LunarPhaseFilter,
	ModalityFilters,
	OrientationFilter,
	StelliumFilters,
	UnaspectedFilter
} from './fact-filter-sections';

export type ChartQueryUpdate = (updater: (current: ChartQuery) => ChartQuery) => void;

type GroupContext = {
	query: ChartQuery;
	set: <K extends keyof ChartQuery>(key: K, value: ChartQuery[K]) => void;
	setFacts: (patch: Partial<FactFilters>) => void;
	availableTags: readonly string[];
};

type ChartFilterGroup = {
	id: string;
	labelKey: string;
	className?: string;
	render: (context: GroupContext) => ReactNode;
};

/** Every chart filter group, in display order. Ids are stable (persisted as hidden groups). */
export const CHART_FILTER_GROUPS: readonly ChartFilterGroup[] = [
	{
		id: 'chart-type',
		labelKey: 'open_filter_chart_type',
		className: 'space-y-2',
		render: ({ query, set }) => (
			<ChartTypeFilter value={query.types} onChange={(types) => set('types', types)} />
		)
	},
	{
		id: 'tags',
		labelKey: 'new_tags',
		render: ({ query, set, availableTags }) => (
			<TagFilter
				value={query.tag}
				onChange={(tag) => set('tag', tag)}
				availableTags={availableTags}
			/>
		)
	},
	{
		id: 'date',
		labelKey: 'new_date',
		render: ({ query, set }) => (
			<DateFilter value={query.date} onChange={(date) => set('date', date)} />
		)
	},
	{
		id: 'location',
		labelKey: 'new_location',
		className: 'pt-1',
		render: ({ query, set }) => (
			<LocationFilter value={query.location} onChange={(location) => set('location', location)} />
		)
	},
	{
		id: 'planets',
		labelKey: 'open_filter_planets',
		render: ({ query, set }) => (
			<PlanetFilters value={query.planets} onChange={(planets) => set('planets', planets)} />
		)
	},
	{
		id: 'aspects',
		labelKey: 'open_filter_aspects',
		className: 'space-y-2',
		render: ({ query, set }) => (
			<AspectFilters value={query.aspects} onChange={(aspects) => set('aspects', aspects)} />
		)
	},
	{
		id: 'houses',
		labelKey: 'open_filter_houses',
		render: ({ query, set }) => (
			<HouseFilters value={query.houses} onChange={(houses) => set('houses', houses)} />
		)
	},
	{
		id: 'shapes',
		labelKey: 'open_filter_chart_shape',
		className: 'space-y-2',
		render: ({ query, set }) => (
			<CatalogFilter catalog="shapes" value={query.shapes} onChange={(v) => set('shapes', v)} />
		)
	},
	{
		id: 'stellium',
		labelKey: 'info_stellium',
		render: ({ query, setFacts }) => (
			<StelliumFilters
				value={query.facts.stelliums}
				onChange={(stelliums) => setFacts({ stelliums })}
			/>
		)
	},
	{
		id: 'configurations',
		labelKey: 'info_planetary_configuration',
		className: 'space-y-2',
		render: ({ query, set }) => (
			<CatalogFilter
				catalog="configurations"
				value={query.configurations}
				onChange={(v) => set('configurations', v)}
			/>
		)
	},
	{
		id: 'hemispheres',
		labelKey: 'info_hemisphere_emphasis',
		render: ({ query, setFacts }) => (
			<HemisphereFilters
				hemispheres={query.facts.hemispheres}
				quadrants={query.facts.quadrants}
				onChange={setFacts}
			/>
		)
	},
	{
		id: 'modality',
		labelKey: 'info_dominance_mode_quality',
		render: ({ query, setFacts }) => (
			<ModalityFilters
				value={query.facts.modality}
				onChange={(modality) => setFacts({ modality })}
			/>
		)
	},
	{
		id: 'elements',
		labelKey: 'info_dominance_element',
		render: ({ query, setFacts }) => (
			<ElementFilters
				value={query.facts.elements}
				onChange={(elements) => setFacts({ elements })}
			/>
		)
	},
	{
		id: 'house_groups',
		labelKey: 'info_dominance_houses',
		render: ({ query, setFacts }) => (
			<HouseGroupFilters
				value={query.facts.houseGroups}
				onChange={(houseGroups) => setFacts({ houseGroups })}
			/>
		)
	},
	{
		id: 'aspect_dominance',
		labelKey: 'info_dominance_aspects',
		render: ({ query, setFacts }) => (
			<AspectDominanceFilters
				value={query.facts.aspects}
				onChange={(aspects) => setFacts({ aspects })}
			/>
		)
	},
	{
		id: 'mercury_venus',
		labelKey: 'open_filter_mercury_venus',
		render: ({ query, setFacts }) => (
			<InnerPlanetFilters
				mercury={query.facts.mercury}
				venus={query.facts.venus}
				onChange={setFacts}
			/>
		)
	},
	{
		id: 'lunar_phase',
		labelKey: 'info_lunar_phases',
		render: ({ query, setFacts }) => (
			<LunarPhaseFilter
				value={query.facts.lunarPhases}
				onChange={(lunarPhases) => setFacts({ lunarPhases })}
			/>
		)
	},
	{
		id: 'orientation',
		labelKey: 'info_extroversion_introversion_ratio',
		render: ({ query, setFacts }) => (
			<OrientationFilter
				value={query.facts.orientation}
				onChange={(orientation) => setFacts({ orientation })}
			/>
		)
	},
	{
		id: 'horizon',
		labelKey: 'info_sun_moon_horizon',
		render: ({ query, setFacts }) => (
			<HorizonFilter value={query.facts.horizon} onChange={(horizon) => setFacts({ horizon })} />
		)
	},
	{
		id: 'angular',
		labelKey: 'info_angular_planet',
		render: ({ query, setFacts }) => (
			<AngularPlanetFilter
				value={query.facts.angular}
				onChange={(angular) => setFacts({ angular })}
			/>
		)
	},
	{
		id: 'unaspected',
		labelKey: 'info_unaspect_planets',
		render: ({ query, setFacts }) => (
			<UnaspectedFilter
				value={query.facts.unaspected}
				onChange={(unaspected) => setFacts({ unaspected })}
			/>
		)
	},
	{
		id: 'ruler',
		labelKey: 'info_horoscope_ruler',
		render: ({ query, setFacts }) => (
			<ChartRulerFilter value={query.facts.ruler} onChange={(ruler) => setFacts({ ruler })} />
		)
	},
	{
		id: 'dispositor_traditional',
		labelKey: 'open_filter_final_dispositor_traditional',
		render: ({ query, setFacts }) => (
			<DispositorFilter
				system="traditional"
				value={query.facts.dispositorTraditional}
				onChange={(dispositorTraditional) => setFacts({ dispositorTraditional })}
			/>
		)
	},
	{
		id: 'dispositor_modern',
		labelKey: 'open_filter_final_dispositor_modern',
		render: ({ query, setFacts }) => (
			<DispositorFilter
				system="modern"
				value={query.facts.dispositorModern}
				onChange={(dispositorModern) => setFacts({ dispositorModern })}
			/>
		)
	}
];

/** Collapsible panel of the chart filter groups listed in `visibleGroups`, editing `query`. */
export function ChartFilterPanel({
	query,
	onQueryChange,
	visibleGroups,
	availableTags = []
}: {
	query: ChartQuery;
	onQueryChange: ChartQueryUpdate;
	visibleGroups: readonly string[];
	availableTags?: readonly string[];
}) {
	const { t } = useTranslation();
	const context: GroupContext = {
		query,
		availableTags,
		set: (key, value) => onQueryChange((current) => ({ ...current, [key]: value })),
		setFacts: (patch) =>
			onQueryChange((current) => ({ ...current, facts: { ...current.facts, ...patch } }))
	};
	return (
		<Accordion type="multiple" className="w-full">
			{CHART_FILTER_GROUPS.filter((group) => visibleGroups.includes(group.id)).map((group) => (
				<FilterSection
					key={group.id}
					id={group.id}
					title={t(group.labelKey)}
					className={group.className}
				>
					{group.render(context)}
				</FilterSection>
			))}
		</Accordion>
	);
}
