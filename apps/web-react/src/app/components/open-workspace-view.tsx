import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Star } from 'lucide-react';
import { AppMainContentContainer, AppMainContentRoot } from './app-main-content';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';
import { useWorkspaceCharts } from '../providers/workspace-charts';
import type { AppChart } from '@/lib/tauri/chartPayload';

type OpenMode = 'my_radixes' | 'database' | 'favorites' | 'history';

export type OpenWorkspaceViewProps = {
	theme: Theme;
	workspacePath: string | null;
	onOpenWorkspace: () => void | Promise<void>;
	onSaveWorkspace: () => void | Promise<void>;
	/** Select chart and return to horoscope view. */
	onActivateChart: (chartId: string) => void;
};

function chartTypeLabel(chart: AppChart, t: (k: string) => string) {
	const mode = chart.chartType?.toUpperCase();
	if (mode === 'NATAL') return t('new_type_radix');
	if (mode === 'EVENT') return t('new_type_event');
	if (mode === 'HORARY') return t('new_type_horary');
	return chart.chartType;
}

function splitDateTime(value: string) {
	if (!value) return { date: '', time: '' };
	const normalized = value.trim().replace('T', ' ');
	if (normalized.includes('Z')) {
		const isoDate = new Date(value);
		if (!Number.isNaN(isoDate.getTime())) {
			return {
				date: isoDate.toLocaleDateString(),
				time: isoDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			};
		}
	}

	const [date = '', time = ''] = normalized.split(/\s+/, 2);
	return { date, time: time.replace(/Z$/, '') };
}

function chartMatchesMode(chart: AppChart, mode: OpenMode, favorites: Set<string>) {
	if (mode === 'favorites') return favorites.has(chart.id);
	if (mode === 'database') return false;
	return true;
}

const planetTranslationKeys = [
	'planet_sun',
	'planet_moon',
	'planet_mercury',
	'planet_venus',
	'planet_mars',
	'planet_jupiter',
	'planet_saturn',
	'planet_uranus',
	'planet_neptune',
	'planet_pluto'
] as const;

const zodiacTranslationKeys = [
	'open_sign_aries',
	'open_sign_taurus',
	'open_sign_gemini',
	'open_sign_cancer',
	'open_sign_leo',
	'open_sign_virgo',
	'open_sign_libra',
	'open_sign_scorpio',
	'open_sign_sagittarius',
	'open_sign_capricorn',
	'open_sign_aquarius',
	'open_sign_pisces'
] as const;

export function OpenWorkspaceView({
	theme,
	workspacePath,
	onOpenWorkspace,
	onSaveWorkspace,
	onActivateChart
}: OpenWorkspaceViewProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const { charts, selectedChartId } = useWorkspaceCharts();
	const [openMode, setOpenMode] = useState<OpenMode>('my_radixes');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedRows, setSelectedRows] = useState<string[]>([]);
	const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
	const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

	const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
	const planetLabels = useMemo(() => planetTranslationKeys.map((key) => t(key)), [t]);
	const zodiacLabels = useMemo(() => zodiacTranslationKeys.map((key) => t(key)), [t]);
	const availableTypes = useMemo(() => {
		return Array.from(
			new Set(
				charts
					.map((chart) => chartTypeLabel(chart, t))
					.filter((value): value is string => typeof value === 'string' && value.length > 0)
			)
		);
	}, [charts, t]);

	const availableTags = useMemo(() => {
		return Array.from(
			new Set(charts.flatMap((chart) => chart.tags ?? []).filter((tag) => tag.trim().length > 0))
		);
	}, [charts]);

	const filtered = useMemo(() => {
		if (openMode === 'database') return [] as AppChart[];

		const q = searchQuery.trim().toLowerCase();
		return charts.filter((chart) => {
			if (!chartMatchesMode(chart, openMode, favorites)) return false;

			const normalizedType = chartTypeLabel(chart, t);
			if (selectedTypes.length > 0 && !selectedTypes.includes(normalizedType)) return false;

			if (!q) return true;

			const tags = (chart.tags ?? []).join(' ').toLowerCase();
			return (
				chart.name.toLowerCase().includes(q) ||
				(chart.location ?? '').toLowerCase().includes(q) ||
				(chart.dateTime ?? '').toLowerCase().includes(q) ||
				normalizedType.toLowerCase().includes(q) ||
				tags.includes(q)
			);
		});
	}, [charts, favorites, openMode, searchQuery, selectedTypes, t]);

	const toggleRowSelection = (id: string) => {
		setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
	};

	const toggleFavorite = (id: string) => {
		setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]));
	};

	const toggleType = (type: string) => {
		setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
	};

	const resetFilters = () => {
		setSearchQuery('');
		setSelectedRows([]);
		setSelectedTypes([]);
	};

	return (
		<AppMainContentRoot className={cn(ft.formPageBg, 'h-full')} layout="edge-to-edge">
			<AppMainContentContainer maxWidth="full" className="flex h-full min-h-0 flex-1 flex-col">
				<div className="flex h-full min-h-[calc(100vh-8rem)] flex-1 flex-col xl:min-h-[42rem] xl:flex-row">
					<div
						className="relative flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b xl:w-[40%] xl:border-r xl:border-b-0"
						style={{
							background:
								'linear-gradient(to bottom, var(--theme-secondary-sidebar-start) 0%, var(--theme-secondary-sidebar-end) 100%)',
							borderColor: 'var(--theme-sidebar-border)',
							color: 'var(--theme-nav-text-primary)'
						}}
					>
							<div className="px-4 pt-4 pb-2 sm:px-6">
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className={cn(ft.footerCancel, 'h-8 px-3 py-1 text-xs')}
										onClick={() => void onOpenWorkspace()}
									>
										{t('open_workspace')}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className={cn(ft.footerCancel, 'h-8 px-3 py-1 text-xs')}
										onClick={() => void onSaveWorkspace()}
									>
										{t('save_workspace')}
									</Button>
								</div>
								<p className={cn('mt-2 truncate text-xs', ft.muted)}>
									{workspacePath ?? t('open_table_empty')}
								</p>
							</div>
							<Separator className="bg-[color:var(--theme-sidebar-border)]" />
							<div className={cn('border-b px-4 sm:px-6', ft.footerBorder)}>
								<div className="flex min-h-16 items-center">
									{[
										{ id: 'my_radixes', label: t('open_mode_my_radixes') },
										{ id: 'database', label: t('open_mode_database') },
										{ id: 'favorites', label: t('favorite') },
										{ id: 'history', label: t('open_mode_history') }
									].map((tab) => (
										<Button
											key={tab.id}
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => setOpenMode(tab.id as OpenMode)}
											className={cn(
												'relative h-16 min-w-0 flex-1 rounded-none px-2 text-center text-sm transition-colors',
												openMode === tab.id ? ft.title : ft.muted
											)}
										>
											<span className="truncate">{tab.label}</span>
											{openMode === tab.id ? (
												<span
													className={cn(
														'absolute inset-x-2 bottom-0 h-0.5 rounded-full',
														'bg-[color:var(--theme-accent)]'
													)}
												/>
											) : null}
										</Button>
									))}
								</div>
							</div>

							<div className="px-4 pt-4 pb-2 sm:px-6">
								<Label htmlFor="open-search" className="sr-only">
									{t('search_fulltext')}
								</Label>
								<div className="relative">
									<Search className={cn('absolute top-1/2 left-3 size-4 -translate-y-1/2', ft.muted)} />
									<Input
										id="open-search"
										type="search"
										placeholder={t('search_fulltext')}
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className={cn(ft.input, 'pl-10')}
									/>
								</div>
							</div>

							<div className="min-h-0 flex-1 overflow-y-auto px-0 py-3 pb-28">
								<Accordion type="multiple" className="w-full">
									<AccordionItem value="chart-type" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('new_type')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="space-y-3">
												{availableTypes.map((type) => (
													<div key={type} className="flex items-center gap-2">
														<Checkbox
															id={`type-${type}`}
															checked={selectedTypes.includes(type)}
															onCheckedChange={() => toggleType(type)}
														/>
														<label htmlFor={`type-${type}`} className={cn('cursor-pointer text-sm', ft.bodyText)}>
															{type}
														</label>
													</div>
												))}
											</div>
										</AccordionContent>
									</AccordionItem>

									<AccordionItem value="tags" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('new_tags')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="flex flex-wrap gap-2">
												{availableTags.length > 0 ? (
													availableTags.map((tag) => (
														<Badge
															key={tag}
															variant="secondary"
															className="px-2.5 py-0.5 text-xs"
														>
															{tag}
														</Badge>
													))
												) : (
													<p className={cn('text-sm', ft.muted)}>{t('open_table_empty')}</p>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>

									<AccordionItem value="date" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('new_date')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="space-y-3">
												<div className="space-y-2">
													<label className={cn('block text-sm', ft.bodyText)}>{t('open_filter_date_from')}</label>
													<Input type="date" className={ft.inputCompact} />
												</div>
												<div className="space-y-2">
													<label className={cn('block text-sm', ft.bodyText)}>{t('open_filter_date_to')}</label>
													<Input type="date" className={ft.inputCompact} />
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									<AccordionItem value="location" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('new_location')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="space-y-3">
												<Input
													placeholder={t('new_placeholder_any_location')}
													className={ft.inputCompact}
												/>
												<div className="flex items-center gap-2">
													<Checkbox id="location-local-only" />
													<label htmlFor="location-local-only" className={cn('cursor-pointer text-sm', ft.bodyText)}>
														{t('open_filter_location_local_only')}
													</label>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									<AccordionItem value="metadata" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('open_filter_metadata')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="space-y-3">
												<div className="flex items-center gap-2">
													<Checkbox id="metadata-notes" />
													<label htmlFor="metadata-notes" className={cn('cursor-pointer text-sm', ft.bodyText)}>
														{t('open_filter_with_notes')}
													</label>
												</div>
												<div className="flex items-center gap-2">
													<Checkbox id="metadata-files" />
													<label htmlFor="metadata-files" className={cn('cursor-pointer text-sm', ft.bodyText)}>
														{t('open_filter_with_files')}
													</label>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									<AccordionItem value="planets" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('open_filter_planets')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="overflow-x-auto">
												<div className="min-w-[28rem]">
													<div className={cn('mb-2 grid grid-cols-[80px_1fr_60px_60px_90px] gap-2 text-xs font-medium', ft.muted)}>
														<div />
														<div>{t('open_filter_sign')}</div>
														<div>{t('open_filter_degree')}</div>
														<div>{t('open_filter_house')}</div>
														<div>{t('open_filter_motion')}</div>
													</div>
													<div className="space-y-2">
														{planetLabels.map((planet) => (
															<div key={planet} className="grid grid-cols-[80px_1fr_60px_60px_90px] items-center gap-2 text-sm">
																<div className={cn('truncate', ft.bodyText)}>{planet}</div>
																<Select>
																	<SelectTrigger className={cn(ft.inputCompact, 'w-full px-2 py-1 text-xs')}>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		{zodiacLabels.map((sign) => (
																			<SelectItem key={sign} value={sign} className={ft.selectItem}>
																				{sign}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																<Select>
																	<SelectTrigger className={cn(ft.inputCompact, 'w-full px-2 py-1 text-xs')}>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		{Array.from({ length: 30 }, (_, i) => i + 1).map((degree) => (
																			<SelectItem key={degree} value={String(degree)} className={ft.selectItem}>
																				{degree}°
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																<Select>
																	<SelectTrigger className={cn(ft.inputCompact, 'w-full px-2 py-1 text-xs')}>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		{Array.from({ length: 12 }, (_, i) => i + 1).map((house) => (
																			<SelectItem key={house} value={String(house)} className={ft.selectItem}>
																				{house}.
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																<Select>
																	<SelectTrigger className={cn(ft.inputCompact, 'w-full px-2 py-1 text-xs')}>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent className={ft.selectContent}>
																		<SelectItem value="direct" className={ft.selectItem}>
																			{t('open_motion_direct')}
																		</SelectItem>
																		<SelectItem value="stationary" className={ft.selectItem}>
																			{t('open_motion_stationary')}
																		</SelectItem>
																		<SelectItem value="retrograde" className={ft.selectItem}>
																			{t('open_motion_retrograde')}
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>
														))}
													</div>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									<AccordionItem value="open-aspects" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('open_filter_aspects')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="space-y-3">
												{[t('aspect_conjunction'), t('aspect_opposition'), t('aspect_trine')].map((aspect) => (
													<div key={aspect} className="flex items-center gap-2">
														<Checkbox id={`aspect-${aspect}`} />
														<label htmlFor={`aspect-${aspect}`} className={cn('cursor-pointer text-sm', ft.bodyText)}>
															{aspect}
														</label>
													</div>
												))}
											</div>
										</AccordionContent>
									</AccordionItem>

									<AccordionItem value="houses" className="border-none">
										<AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
											{t('open_filter_houses')}
										</AccordionTrigger>
										<AccordionContent className="px-4 sm:px-6">
											<div className="grid grid-cols-3 gap-2">
												{Array.from({ length: 12 }, (_, i) => i + 1).map((house) => (
													<div key={house} className="flex items-center gap-2">
														<Checkbox id={`house-${house}`} />
														<label htmlFor={`house-${house}`} className={cn('cursor-pointer text-sm', ft.bodyText)}>
															{house}.
														</label>
													</div>
												))}
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</div>

							<div
								className="absolute right-0 bottom-0 left-0 z-10 p-4 sm:p-6"
								style={{
									background:
										'linear-gradient(to top, var(--theme-secondary-sidebar-end) 0%, var(--theme-overlay-bg) 46%, transparent 100%)'
								}}
							>
								<Button type="button" variant="outline" className={cn('w-full', ft.footerCancel)} onClick={resetFilters}>
									{t('clear')}
								</Button>
							</div>
						</div>

						<div className="flex min-w-0 flex-1 flex-col">
							<div className={cn('border-b px-4 sm:px-6', ft.footerBorder)}>
								<div className="grid min-h-16 grid-cols-[40px_40px_minmax(12rem,1.5fr)_minmax(8rem,1fr)_minmax(10rem,1fr)_minmax(7rem,.8fr)_minmax(6rem,.7fr)_minmax(10rem,1.2fr)] items-center gap-2 text-sm">
									<div />
									<div />
									<div className={cn('font-medium', ft.label)}>{t('table_name')}</div>
									<div className={cn('font-medium', ft.label)}>{t('table_chart_type')}</div>
									<div className={cn('font-medium', ft.label)}>{t('table_tags')}</div>
									<div className={cn('font-medium', ft.label)}>{t('new_date')}</div>
									<div className={cn('font-medium', ft.label)}>{t('new_time')}</div>
									<div className={cn('font-medium', ft.label)}>{t('table_place')}</div>
								</div>
							</div>

							<div className="flex-1 overflow-auto">
								{openMode === 'database' ? (
									<div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
										<p className={cn('text-lg font-medium', ft.title)}>{t('open_mode_database')}</p>
										<p className={cn('max-w-md text-sm', ft.muted)}>{t('database_placeholder')}</p>
									</div>
								) : filtered.length === 0 ? (
									<div className="flex min-h-full items-center justify-center p-8 text-center">
										<p className={cn('max-w-md text-sm', ft.muted)}>
											{charts.length === 0 ? t('open_table_empty') : t('open_search_no_results')}
										</p>
									</div>
								) : (
									filtered.map((chart) => {
										const dateTime = splitDateTime(chart.dateTime);
										return (
											<div
												key={chart.id}
												className={cn(
													'grid cursor-pointer grid-cols-[40px_40px_minmax(12rem,1.5fr)_minmax(8rem,1fr)_minmax(10rem,1fr)_minmax(7rem,.8fr)_minmax(6rem,.7fr)_minmax(10rem,1.2fr)] items-center gap-2 border-b px-4 py-3 text-sm transition-colors sm:px-6',
													selectedChartId === chart.id
														? theme === 'sunrise'
															? 'bg-[color:var(--theme-selected-bg)]'
															: theme === 'midnight' || theme === 'twilight'
																? 'bg-[color:var(--theme-selected-bg)]'
																: 'bg-[color:var(--theme-selected-bg)]'
														: 'hover:bg-[color:var(--token-hover-strong)]'
												)}
												onClick={() => onActivateChart(chart.id)}
											>
												<div
													className="flex items-center"
													onClick={(event) => event.stopPropagation()}
												>
													<Checkbox
														checked={selectedRows.includes(chart.id)}
														onCheckedChange={() => toggleRowSelection(chart.id)}
													/>
												</div>
												<div
													className="flex items-center"
													onClick={(event) => event.stopPropagation()}
												>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => toggleFavorite(chart.id)}
														className="h-7 w-7"
														aria-label={t('favorite')}
													>
														<Star
															className={cn(
																'size-4',
																favorites.has(chart.id)
																	? 'fill-[color:var(--theme-accent)] text-[color:var(--theme-accent)]'
																	: ft.muted
															)}
														/>
													</Button>
												</div>
												<div className={cn('min-w-0 truncate', ft.bodyText)}>{chart.name}</div>
												<div className={cn('min-w-0 truncate', ft.muted)}>
													{chartTypeLabel(chart, t)}
												</div>
												<div className="min-w-0">
													<div className="flex flex-wrap gap-1">
														{(chart.tags ?? []).map((tag) => (
															<Badge
																key={`${chart.id}-${tag}`}
																variant="outline"
																className="px-2 py-0.5 text-xs"
															>
																{tag}
															</Badge>
														))}
													</div>
												</div>
												<div className={cn('truncate', ft.muted)}>{dateTime.date}</div>
												<div className={cn('truncate', ft.muted)}>{dateTime.time}</div>
												<div className={cn('min-w-0 truncate', ft.muted)}>{chart.location}</div>
											</div>
										);
									})
								)}
							</div>
						</div>
				</div>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
