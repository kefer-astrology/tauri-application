import { Toolbar, Surface, ActionBar } from '@/app/components/ui/container';
import { Text } from '@/app/components/ui/typography';
import { useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import type { ElementColors } from '@/lib/astrology/elementColors';
import type { WheelStyleId } from '@/lib/astrology/wheelStyle';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import {
	HoroscopeWheel,
	type HemisphereOverlayKind,
	type HoroscopeWheelBody
} from '@/app/views/domain/horoscope-wheel/horoscope-wheel';

interface InformationViewProps {
	wheelStyle?: WheelStyleId;
	elementColors: ElementColors;
	lightPlanetFill: string;
}

type MicroBadgeId = 'lunar' | 'lights' | 'synodic';
type RetroPatternId = 'all-upper' | 'all-east' | null;
type HemiPreviewId = 'ew-east' | 'ew-west' | 'ns-north' | 'ns-south' | null;

function chipStateClass(locked: boolean, hover: boolean, base: string): string {
	if (locked)
		return cn(
			base,
			'border-[color:var(--theme-accent)] bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-content-primary)] shadow-sm ring-2 ring-[color:var(--theme-accent)]/25'
		);
	if (hover)
		return cn(base, 'border-[color:var(--theme-accent)]/50 bg-[color:var(--theme-soft-bg)]');
	return cn(
		base,
		'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] hover:bg-[color:var(--theme-hover-bg)]'
	);
}

export function InformationView({
	wheelStyle,
	elementColors,
	lightPlanetFill
}: InformationViewProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();

	const [microHover, setMicroHover] = useState<MicroBadgeId | null>(null);
	const [singletonHover, setSingletonHover] = useState(false);
	const [retroPatternHover, setRetroPatternHover] = useState<RetroPatternId>(null);
	const [hemiGaugeHover, setHemiGaugeHover] = useState<HemiPreviewId>(null);
	const [dynamicsMode, setDynamicsMode] = useState(false);
	const [lockedChipId, setLockedChipId] = useState<string | null>(null);
	const [hoverChipId, setHoverChipId] = useState<string | null>(null);
	const [selectedConfig, setSelectedConfig] = useState('t-square');
	const [focalFilterHover, setFocalFilterHover] = useState<string | null>(null);

	const hemisphereOverlay: HemisphereOverlayKind = useMemo(() => {
		if (singletonHover || lockedChipId === 'singleton-saturn') return 'asc-dsc-east';
		if (retroPatternHover === 'all-upper') return 'mc-ic-north';
		if (retroPatternHover === 'all-east') return 'asc-dsc-east';
		if (hemiGaugeHover === 'ew-east') return 'asc-dsc-east';
		if (hemiGaugeHover === 'ew-west') return 'asc-dsc-west';
		if (hemiGaugeHover === 'ns-north') return 'mc-ic-north';
		if (hemiGaugeHover === 'ns-south') return 'mc-ic-south';
		return 'off';
	}, [singletonHover, lockedChipId, retroPatternHover, hemiGaugeHover]);

	const highlightBodies = useMemo(() => {
		const s = new Set<HoroscopeWheelBody>();
		if (microHover === 'lunar') {
			s.add('moon');
		}
		if (microHover === 'lights') {
			s.add('sun');
			s.add('moon');
		}
		if (microHover === 'synodic') {
			s.add('mercury');
			s.add('venus');
		}
		if (singletonHover || lockedChipId === 'singleton-saturn') {
			s.add('saturn');
		}
		if (lockedChipId === 'una' || focalFilterHover === 'una') {
			s.add('mercury');
		}
		return s;
	}, [microHover, singletonHover, lockedChipId, focalFilterHover]);

	const dimNonHighlighted =
		singletonHover ||
		lockedChipId === 'singleton-saturn' ||
		focalFilterHover === 'una' ||
		lockedChipId === 'una' ||
		(microHover !== null && highlightBodies.size > 0);

	const pageShell = cn(
		'flex h-screen min-h-0 flex-col overflow-hidden transition-colors',
		'bg-background text-foreground'
	);

	const smallTitle = cn('text-xs font-semibold uppercase tracking-wide', ft.muted);
	const RailCard = ({ className, ...props }: ComponentProps<typeof Card>) => (
		<Card
			spacing="compact"
			variant="default"
			className={cn('py-3 shadow-sm', className)}
			{...props}
		/>
	);

	const bottomChips: { id: string; label: string }[] = [
		{ id: 'dom-el', label: 'Dominantní živel: Oheň' },
		{ id: 'dom-mod', label: 'Převaha modu: Kardinální' },
		{ id: 'dom-house', label: 'Převaha v domech: Aktivní (rohové)' },
		{ id: 'dom-asp', label: 'Převaha aspektu: Kvadratura' },
		{ id: 'cfg', label: 'Konfigurace: T-kvadratura' },
		{ id: 'stellium', label: 'Stellium: 10. dům' },
		{ id: 'singleton-saturn', label: 'Singleton: Saturn (Východ)' },
		{ id: 'fd', label: 'Finální dispozitor: Saturn' },
		{ id: 'ruler', label: 'Vládce horoskopu: Mars' },
		{ id: 'una', label: 'Neaspektovaná planeta: Merkur' },
		{ id: 'retro', label: 'Retrogradita: 5 planet' },
		{ id: 'lunar', label: 'Lunární fáze: Novoluní 38°' },
		{ id: 'hemi', label: 'Hemisféra: Východ 70 %' },
		{ id: 'quad', label: 'Kvadrant: Q1 35 %' }
	];

	const configs = [
		{ id: 't-square', label: 'T-kvadratura' },
		{ id: 'grand-trine', label: 'Velký trigon' },
		{ id: 'kite', label: 'Kite' },
		{ id: 'yod', label: 'Yod' },
		{ id: 'grand-cross', label: 'Grand cross' },
		{ id: 'mystic', label: 'Mystic rectangle' }
	];

	return (
		<div data-handoff="View_InformationDashboard" className={pageShell}>
			{/* TopBar — app PrimarySidebar is outside this view */}
			<Toolbar
				as="header"
				padding="none"
				align="start"
				wrap="nowrap"
				data-handoff="TopBar"
				className="h-9 px-4"
			>
				<Text variant="label" as="span" tone="primary">
					{t('sidebar_information')}
				</Text>
				<Text variant="caption" as="span" tone="muted" className="ml-2">
					— syntéza & struktura
				</Text>
			</Toolbar>

			<div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2 pt-1">
				{/* LEFT RAIL — Struktura */}
				<ScrollArea
					data-handoff="LeftRail_Structure"
					className="h-full w-[min(100%,280px)] min-w-[240px] flex-shrink-0 pr-1"
				>
					<div className="flex flex-col gap-2 pb-2">
						<RailCard data-handoff="Card_ElementDominance">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Převaha živlu</CardTitle>
								<CardDescription className="text-xs">Legenda: počet planet · podíl</CardDescription>
							</CardHeader>
							<CardContent density="compact" className="space-y-2">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-7 w-full">
										<TabsTrigger value="pos" className="text-xs">
											Pozitivní
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-xs">
											Negativní (neobsazeno)
										</TabsTrigger>
									</TabsList>
									<TabsContent value="pos" className="mt-2 space-y-2">
										<ElementBars positive />
									</TabsContent>
									<TabsContent value="neg" className="mt-2 space-y-2">
										<ElementBars positive={false} />
									</TabsContent>
								</Tabs>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_ModalityDominance">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Převaha modu</CardTitle>
								<CardDescription className="text-xs">Kardinální / Fixní / Mutuální</CardDescription>
							</CardHeader>
							<CardContent density="compact">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-7 w-full">
										<TabsTrigger value="pos" className="text-xs">
											Pozitivní
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-xs">
											Negativní
										</TabsTrigger>
									</TabsList>
									<TabsContent value="pos" className="mt-2">
										<StackedBar
											segments={[
												{ label: 'Kardinální', pct: 50, count: 5, color: 'var(--token-viz-1)' },
												{ label: 'Fixní', pct: 30, count: 3, color: 'var(--token-viz-2)' },
												{ label: 'Mutuální', pct: 20, count: 2, color: 'var(--token-viz-3)' }
											]}
											positive
										/>
									</TabsContent>
									<TabsContent value="neg" className="mt-2">
										<StackedBar
											segments={[
												{ label: 'Kardinální', pct: 0, count: 0, color: 'var(--token-viz-1)' },
												{ label: 'Fixní', pct: 0, count: 0, color: 'var(--token-viz-2)' },
												{ label: 'Mutuální', pct: 100, count: 0, color: 'var(--token-viz-3)' }
											]}
											positive={false}
										/>
										<Text variant="caption" tone="muted" className="mt-1">
											neobsazeno (outline)
										</Text>
									</TabsContent>
								</Tabs>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_HouseTypeDominance">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Převaha v domech</CardTitle>
								<CardDescription className="text-xs">
									Aktivní / Reaktivní / Výsledné + heatmap I–XII
								</CardDescription>
							</CardHeader>
							<CardContent density="compact" className="space-y-2">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-7 w-full">
										<TabsTrigger value="pos" className="text-xs">
											Pozitivní
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-xs">
											Negativní
										</TabsTrigger>
									</TabsList>
									<TabsContent value="pos" className="mt-2 space-y-2">
										<StackedBar
											segments={[
												{ label: 'Rohové', pct: 40, count: 4, color: 'var(--token-viz-1)' },
												{ label: 'Následné', pct: 35, count: 3, color: 'var(--token-viz-2)' },
												{ label: 'Koncové', pct: 25, count: 2, color: 'var(--token-viz-4)' }
											]}
											positive
										/>
										<HouseHeatmap />
									</TabsContent>
									<TabsContent value="neg" className="mt-2 space-y-2">
										<StackedBar
											segments={[
												{ label: 'Rohové', pct: 0, count: 0, color: 'var(--token-viz-1)' },
												{ label: 'Následné', pct: 0, count: 0, color: 'var(--token-viz-2)' },
												{ label: 'Koncové', pct: 100, count: 0, color: 'var(--token-viz-4)' }
											]}
											positive={false}
										/>
										<Text variant="caption" tone="muted">
											neobsazeno
										</Text>
									</TabsContent>
								</Tabs>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Quadrants">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Kvadranty</CardTitle>
								<CardDescription className="text-xs">Q1–Q4 · podíl</CardDescription>
							</CardHeader>
							<CardContent density="compact">
								<QuadrantDonut />
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Hemispheres">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Hemisféry</CardTitle>
								<CardDescription className="text-xs">
									Pouze planety (osy se nepočítají). Náhled overlay v centru při hoveru.
								</CardDescription>
							</CardHeader>
							<CardContent density="compact" className="space-y-3">
								<div>
									<p className={smallTitle}>Východ (ASC) vs Západ (DSC)</p>
									<div className="mt-1 flex gap-2">
										<Button
											type="button"
											data-state={hemiGaugeHover === 'ew-east' ? 'hover-preview' : 'default'}
											variant="ghost"
											size="sm"
											className="h-auto flex-1 justify-start rounded-lg px-2 py-1.5 text-left text-xs"
											onMouseEnter={() => setHemiGaugeHover('ew-east')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Východ{' '}
											<span className="text-[color:var(--theme-content-muted)]">7/10 · 70 %</span>
										</Button>
										<Button
											type="button"
											data-state={hemiGaugeHover === 'ew-west' ? 'hover-preview' : 'default'}
											variant="ghost"
											size="sm"
											className="h-auto flex-1 justify-start rounded-lg px-2 py-1.5 text-left text-xs"
											onMouseEnter={() => setHemiGaugeHover('ew-west')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Západ{' '}
											<span className="text-[color:var(--theme-content-muted)]">3/10 · 30 %</span>
										</Button>
									</div>
									<HemiBalanceBar leftPct={70} />
								</div>
								<Separator />
								<div>
									<p className={smallTitle}>Nahoře (MC) vs Dole (IC)</p>
									<div className="mt-1 flex gap-2">
										<Button
											type="button"
											data-state={hemiGaugeHover === 'ns-north' ? 'hover-preview' : 'default'}
											variant="ghost"
											size="sm"
											className="h-auto flex-1 justify-start rounded-lg px-2 py-1.5 text-left text-xs"
											onMouseEnter={() => setHemiGaugeHover('ns-north')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Nahoře{' '}
											<span className="text-[color:var(--theme-content-muted)]">6/10 · 60 %</span>
										</Button>
										<Button
											type="button"
											data-state={hemiGaugeHover === 'ns-south' ? 'hover-preview' : 'default'}
											variant="ghost"
											size="sm"
											className="h-auto flex-1 justify-start rounded-lg px-2 py-1.5 text-left text-xs"
											onMouseEnter={() => setHemiGaugeHover('ns-south')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Dole{' '}
											<span className="text-[color:var(--theme-content-muted)]">4/10 · 40 %</span>
										</Button>
									</div>
									<HemiBalanceBar leftPct={60} />
								</div>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_ExtroIntro">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Extroverze / Introverze</CardTitle>
								<CardDescription className="text-xs">
									Dummy balance · orientace hemisfér
								</CardDescription>
							</CardHeader>
							<CardContent density="compact">
								<Surface
									variant="soft"
									padding="none"
									className="relative h-8 w-full overflow-hidden"
								>
									<div
										className="absolute top-0 left-0 h-full w-1/2"
										style={{ width: '58%', backgroundColor: 'var(--token-viz-1)' }}
									/>
									<div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
										58 % extro · 42 % intro
									</div>
								</Surface>
								<Text variant="caption" tone="muted" className="mt-1">
									Východní hemisféra + horní · dummy váha
								</Text>
							</CardContent>
						</RailCard>
					</div>
				</ScrollArea>

				{/* CENTER */}
				<Surface
					variant="panel"
					padding="none"
					data-handoff="Center_Horoscope"
					data-hemisphere-overlay={hemisphereOverlay}
					className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
				>
					<div className="flex flex-shrink-0 flex-wrap items-start justify-end gap-1.5 px-2 pt-2">
						<Badge
							data-handoff="MicroBadge_LunarPhase"
							variant="outline"
							className={cn(
								'h-auto max-w-[200px] cursor-default px-2 py-1 text-xs leading-tight font-normal',
								microHover === 'lunar' && 'ring-primary/30 ring-2'
							)}
							onMouseEnter={() => setMicroHover('lunar')}
							onMouseLeave={() => setMicroHover(null)}
						>
							Lunární fáze: Novoluní · 38°
						</Badge>
						<Badge
							data-handoff="MicroBadge_LightsHorizon"
							variant="outline"
							className={cn(
								'h-auto max-w-[200px] cursor-default px-2 py-1 text-xs leading-tight font-normal',
								microHover === 'lights' && 'ring-primary/30 ring-2'
							)}
							onMouseEnter={() => setMicroHover('lights')}
							onMouseLeave={() => setMicroHover(null)}
						>
							<span className="inline-flex flex-wrap items-center gap-0.5">
								<span>{'Světla & obzor:'}</span>
								<AstrologyGlyph
									glyphId="sun"
									fallback="☉"
									size={12}
									className="inline-block align-middle"
								/>
								<span>nad ·</span>
								<AstrologyGlyph
									glyphId="moon"
									fallback="☾"
									size={12}
									className="inline-block align-middle"
								/>
								<span>pod</span>
							</span>
						</Badge>
						<Badge
							data-handoff="MicroBadge_SynodicRoles"
							variant="outline"
							className={cn(
								'h-auto max-w-[210px] cursor-default px-2 py-1 text-xs leading-tight font-normal',
								microHover === 'synodic' && 'ring-primary/30 ring-2'
							)}
							onMouseEnter={() => setMicroHover('synodic')}
							onMouseLeave={() => setMicroHover(null)}
						>
							<span className="inline-flex flex-wrap items-center gap-0.5">
								<AstrologyGlyph
									glyphId="mercury"
									fallback="☿"
									size={12}
									className="inline-block align-middle"
								/>
								<span>Prometheus ·</span>
								<AstrologyGlyph
									glyphId="venus"
									fallback="♀"
									size={12}
									className="inline-block align-middle"
								/>
								<span>Jitřenka</span>
							</span>
						</Badge>
					</div>

					<div className="relative min-h-0 flex-1">
						<div className="flex h-full min-h-[200px] items-center justify-center p-1">
							<HoroscopeWheel
								wheelStyle={wheelStyle}
								elementColors={elementColors}
								lightPlanetFill={lightPlanetFill}
								showPlanetGlyphs
								showAxisLines
								highlightBodies={highlightBodies}
								dimNonHighlighted={dimNonHighlighted}
								hemisphereOverlay={hemisphereOverlay}
								className="max-h-full max-w-full"
							/>
						</div>
					</div>

					<div className="flex-shrink-0 px-2 pb-2">
						<RailCard data-handoff="Card_ShapeDiagram" className="gap-1 py-2">
							<CardContent
								density="compact"
								className="flex items-center justify-between gap-3 py-2"
							>
								<div>
									<Text variant="compactLabel" tone="primary">
										Tvarový diagram horoskopu
									</Text>
									<Text variant="caption" tone="muted">
										Pattern: Bucket
									</Text>
								</div>
								<div
									className="flex h-10 w-14 items-end justify-center gap-0.5 rounded-lg border border-dashed p-1 text-[color:var(--theme-content-muted)]"
									aria-hidden
								>
									<span className="bg-primary/40 h-3 w-1 rounded-md" />
									<span className="bg-primary/60 h-6 w-1 rounded-md" />
									<span className="bg-primary/40 h-4 w-1 rounded-md" />
									<span className="bg-primary h-8 w-1 rounded-md" />
								</div>
							</CardContent>
						</RailCard>
					</div>
				</Surface>

				{/* RIGHT RAIL */}
				<ScrollArea
					data-handoff="RightRail_DynamicsFoci"
					className="h-full w-[min(100%,340px)] min-w-[280px] flex-shrink-0 pr-1"
				>
					<div className="flex flex-col gap-2 pb-2">
						<RailCard data-handoff="Card_Aspects" className="gap-1">
							<CardHeader density="compact">
								<div className="flex items-center justify-between gap-2">
									<CardTitle className={cn('text-sm', ft.title)}>Aspekty</CardTitle>
									<div className="flex items-center gap-2">
										<Switch
											id="dynamics-mode"
											checked={dynamicsMode}
											onCheckedChange={setDynamicsMode}
										/>
										<Label variant="compact" tone="muted" htmlFor="dynamics-mode">
											Dynamika v kruhu
										</Label>
									</div>
								</div>
								<CardDescription className="text-xs">
									Přepínání histogramu · náhled v kruhu
								</CardDescription>
							</CardHeader>
							<CardContent density="compact">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-8 w-full">
										<TabsTrigger value="pos" className="text-xs">
											Pozitivní převaha
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-xs">
											Negativní dynamika
										</TabsTrigger>
									</TabsList>
									<TabsContent value="pos" className="mt-2">
										<div className="space-y-1">
											<AspectHistogram positive />
										</div>
									</TabsContent>
									<TabsContent value="neg" className="mt-2">
										<AspectNegativeAbsence />
									</TabsContent>
								</Tabs>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Configurations">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Konfigurace</CardTitle>
							</CardHeader>
							<CardContent density="compact">
								<ScrollArea className="h-[100px] w-full rounded-lg border">
									<div className="flex flex-col gap-1 p-2">
										{configs.map((c) => (
											<Button
												key={c.id}
												type="button"
												variant="ghost"
												size="sm"
												data-state={selectedConfig === c.id ? 'active' : 'default'}
												className={cn(
													'h-auto justify-start rounded-lg px-2 py-1 text-left text-xs transition-colors',
													selectedConfig === c.id
														? 'bg-accent text-accent-foreground font-medium'
														: 'hover:bg-[color:var(--theme-hover-bg)]'
												)}
												onClick={() => setSelectedConfig(c.id)}
											>
												{c.label}
											</Button>
										))}
									</div>
								</ScrollArea>
								<Surface
									variant="soft"
									padding="none"
									data-handoff="ConfigPreview_MiniDiagram"
									className="mt-2 flex h-16 items-center justify-center border-dashed text-xs text-[color:var(--theme-content-muted)]"
								>
									Preview: {configs.find((c) => c.id === selectedConfig)?.label ?? '—'}
								</Surface>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Stellium">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Stellium</CardTitle>
							</CardHeader>
							<CardContent density="compact" className="space-y-1">
								<Text variant="label">Stellium: 10. dům (3 planety)</Text>
								<Text variant="caption" tone="muted" className="flex items-center gap-1">
									<AstrologyGlyph glyphId="sun" fallback="☉" size={14} />
									<AstrologyGlyph glyphId="venus" fallback="♀" size={14} />
									<AstrologyGlyph glyphId="jupiter" fallback="♃" size={14} />
								</Text>
							</CardContent>
						</RailCard>

						<RailCard
							data-handoff="Card_SingletonHemisphere"
							onMouseEnter={() => setSingletonHover(true)}
							onMouseLeave={() => setSingletonHover(false)}
						>
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Singleton v hemisféře</CardTitle>
							</CardHeader>
							<CardContent density="compact">
								<p className="text-[12px] leading-snug">
									Singleton: <span className="font-medium">Saturn</span> – Východní hemisféra
								</p>
								<Text variant="caption" tone="muted" className="mt-1">
									Hover: halo planety + hemisférický overlay (ASC–DSC)
								</Text>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Retrograde">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Retrogradita</CardTitle>
							</CardHeader>
							<CardContent density="compact" className="space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<Text variant="body" as="span">
										Retrográdní planety: 5/10
									</Text>
									<Badge variant="secondary" className="text-xs">
										výrazná
									</Badge>
								</div>
								<p className={smallTitle}>Retrográdní vzorce</p>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-auto w-full justify-start rounded-lg px-2 py-1.5 text-left text-xs"
									onMouseEnter={() => setRetroPatternHover('all-upper')}
									onMouseLeave={() => setRetroPatternHover(null)}
								>
									Všechny planety nahoře retrográdní → náhled MC hemisféra
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-auto w-full justify-start rounded-lg px-2 py-1.5 text-left text-xs"
									onMouseEnter={() => setRetroPatternHover('all-east')}
									onMouseLeave={() => setRetroPatternHover(null)}
								>
									Všechny planety na východě retrográdní → náhled ASC hemisféra
								</Button>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_FocalPlanets">
							<CardHeader density="compact">
								<CardTitle className={cn('text-sm', ft.title)}>Ohniskové planety</CardTitle>
								<CardDescription className="text-xs">
									Unified focus panel · filtry (multi)
								</CardDescription>
							</CardHeader>
							<CardContent density="compact" className="space-y-2">
								<div className="flex flex-wrap gap-1">
									{[
										'Finální dispozitor',
										'Vládce horoskopu',
										'Singleton',
										'Rohová planeta',
										'Poloha (domicil)',
										'Neaspektovaná',
										'Vůdčí planeta',
										'Obráběcí',
										'Trigger',
										'Abstraktní body'
									].map((label) => (
										<Badge
											key={label}
											variant="outline"
											className="cursor-default px-1.5 py-0 text-xs hover:bg-[color:var(--theme-hover-bg)]"
											onMouseEnter={() =>
												setFocalFilterHover(label === 'Neaspektovaná' ? 'una' : null)
											}
											onMouseLeave={() => setFocalFilterHover(null)}
										>
											{label}
										</Badge>
									))}
								</div>
								<ul className="space-y-2 text-xs">
									<FocalRow rank={1} name="Saturn" score={92} badges={['FD', 'Ruler', 'Lead']} />
									<FocalRow rank={2} name="Mars" score={84} badges={['Angular', 'Trigger']} />
									<FocalRow
										rank={3}
										name="Merkur"
										score={71}
										badges={['Una', 'Cutting']}
										onRowHover={(h) => setFocalFilterHover(h ? 'una' : null)}
									/>
								</ul>
								<Text variant="caption" tone="muted">
									Una: při aktivaci zvýraznit planetu bez hlavních aspektů v kruhu (koncept).
								</Text>
							</CardContent>
						</RailCard>
					</div>
				</ScrollArea>
			</div>

			{/* BOTTOM HIGHLIGHTS */}
			<ActionBar
				padding="none"
				align="start"
				wrap="nowrap"
				surface="soft"
				data-handoff="BottomHighlights"
				className="h-11 gap-1.5 overflow-x-auto px-2"
			>
				{bottomChips.map((c) => {
					const locked = lockedChipId === c.id;
					const hover = hoverChipId === c.id;
					return (
						<Button
							key={c.id}
							type="button"
							variant="ghost"
							size="sm"
							data-state={locked ? 'locked-focus' : hover ? 'hover-preview' : 'default'}
							className={chipStateClass(
								locked,
								hover,
								'h-auto shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors'
							)}
							onMouseEnter={() => setHoverChipId(c.id)}
							onMouseLeave={() => setHoverChipId(null)}
							onClick={() => setLockedChipId((prev) => (prev === c.id ? null : c.id))}
						>
							{c.label}
						</Button>
					);
				})}
			</ActionBar>
		</div>
	);
}

function ElementBars({ positive }: { positive: boolean }) {
	const rows = [
		{ label: 'Oheň', n: 4, pct: 40, color: 'var(--token-viz-1)' },
		{ label: 'Země', n: 2, pct: 20, color: 'var(--token-viz-2)' },
		{ label: 'Vzduch', n: 3, pct: 30, color: 'var(--token-viz-3)' },
		{ label: 'Voda', n: 1, pct: 10, color: 'var(--token-viz-4)' }
	];
	if (!positive) {
		return (
			<div className="flex h-16 items-end justify-between gap-1">
				{rows.map((r) => (
					<div key={r.label} className="flex flex-1 flex-col items-center gap-0.5">
						<div
							className={cn(
								'border-muted-foreground/40 w-full rounded-t-lg border-2 border-dashed',
								r.n === 0 ? 'h-[72%]' : 'h-[8%]'
							)}
						/>
						<Text variant="caption" as="span" tone="muted">
							0
						</Text>
						<Text variant="caption" as="span">
							{r.label}
						</Text>
					</div>
				))}
			</div>
		);
	}
	return (
		<div className="flex h-20 items-end justify-between gap-1">
			{rows.map((r) => (
				<div key={r.label} className="flex flex-1 flex-col items-center gap-0.5">
					<div
						className="w-full rounded-t-lg"
						style={{ height: `${r.pct}%`, backgroundColor: r.color }}
					/>
					<Text variant="compactLabel" as="span">
						{r.n} · {r.pct}%
					</Text>
					<Text variant="caption" as="span" tone="muted">
						{r.label}
					</Text>
				</div>
			))}
		</div>
	);
}

function StackedBar({
	segments,
	positive
}: {
	segments: { label: string; pct: number; count: number; color: string }[];
	positive: boolean;
}) {
	return (
		<div>
			<Surface variant="soft" padding="none" className="flex h-3 w-full overflow-hidden">
				{segments.map((s) => (
					<div
						key={s.label}
						style={
							positive ? { width: `${s.pct}%`, backgroundColor: s.color } : { width: `${s.pct}%` }
						}
						className={cn(
							positive ? '' : 'border border-dashed bg-transparent',
							!positive && s.pct === 0 && 'border-muted-foreground/30'
						)}
						data-segment-color={s.color}
						title={s.label}
					/>
				))}
			</Surface>
			<div className="mt-1 flex justify-between text-xs text-[color:var(--theme-content-muted)]">
				{segments.map((s) => (
					<span key={s.label}>
						{s.label} {positive ? `${s.count} (${s.pct}%)` : s.pct === 100 ? 'neobsazeno' : '0'}
					</span>
				))}
			</div>
		</div>
	);
}

function HouseHeatmap() {
	const intensities = [0.2, 0.5, 0.8, 0.3, 0.6, 0.4, 0.9, 0.2, 0.5, 0.7, 0.85, 0.35];
	const labels = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
	return (
		<div className="grid grid-cols-6 gap-0.5">
			{intensities.map((v, i) => (
				<div
					key={labels[i]}
					className="flex aspect-square items-center justify-center rounded-lg border text-xs"
					style={{
						backgroundColor: `color-mix(in srgb, var(--token-viz-1) ${20 + Math.round(v * 50)}%, transparent)`
					}}
				>
					{labels[i]}
				</div>
			))}
		</div>
	);
}

function QuadrantDonut() {
	const parts = [
		{ q: 'Q1', pct: 28 },
		{ q: 'Q2', pct: 24 },
		{ q: 'Q3', pct: 22 },
		{ q: 'Q4', pct: 26 }
	];
	return (
		<div className="flex items-center gap-3">
			<div
				className="h-14 w-14 shrink-0 rounded-full"
				style={{
					background:
						'conic-gradient(var(--token-viz-1) 0% 28%, var(--token-viz-2) 28% 52%, var(--token-viz-3) 52% 74%, var(--token-viz-4) 74% 100%)'
				}}
			/>
			<div className="grid flex-1 grid-cols-2 gap-1 text-xs">
				{parts.map((p) => (
					<div
						key={p.q}
						className="flex items-center justify-between rounded-lg border px-1 py-0.5"
					>
						<span>{p.q}</span>
						<span className="text-[color:var(--theme-content-muted)]">{p.pct}%</span>
					</div>
				))}
			</div>
		</div>
	);
}

function HemiBalanceBar({ leftPct }: { leftPct: number }) {
	return (
		<Surface variant="soft" padding="none" className="mt-1 h-2 w-full overflow-hidden">
			<div
				className="bg-primary/70 h-full rounded-l-full transition-all"
				style={{ width: `${leftPct}%` }}
			/>
		</Surface>
	);
}

function AspectHistogram({ positive: _positive }: { positive: boolean }) {
	const rows = [
		{ k: 'Konjunkce', n: 4, star: false },
		{ k: 'Opozice', n: 2, star: false },
		{ k: 'Trinus', n: 5, star: true },
		{ k: 'Kvadratura', n: 6, star: false },
		{ k: 'Sextil', n: 3, star: false }
	];
	const max = 6;
	return (
		<div className="space-y-1">
			{rows.map((r) => (
				<div key={r.k} className="flex items-center gap-2">
					<Text variant="caption" as="span" tone="muted" className="w-20">
						{r.k}
					</Text>
					<Surface variant="soft" padding="none" className="h-5 flex-1 overflow-hidden">
						<div
							className="bg-primary/80 h-full rounded-r"
							style={{ width: `${(r.n / max) * 100}%` }}
						/>
					</Surface>
					<Text variant="caption" as="span" className="w-4 tabular-nums">
						{r.n}
					</Text>
					{r.star && (
						<Star
							className="h-3 w-3"
							style={{ color: 'var(--token-viz-1)', fill: 'var(--token-viz-1)' }}
						/>
					)}
				</div>
			))}
		</div>
	);
}

function AspectNegativeAbsence() {
	const rows = [
		{ k: 'Kardinální modalita (osy)' },
		{ k: 'Živel Voda (osy)' },
		{ k: 'Konjunkce (slabé)' }
	];
	return (
		<div className="space-y-2">
			{rows.map((r) => (
				<div key={r.k} className="flex items-center gap-2">
					<Text variant="caption" as="span" tone="muted" className="w-28">
						{r.k}
					</Text>
					<Surface variant="soft" padding="none" className="h-4 flex-1 border-dashed" />
					<Text variant="caption" as="span" tone="muted" className="w-6">
						0
					</Text>
				</div>
			))}
			<Text variant="caption" tone="muted">
				Neobsazenost · neutrální styl
			</Text>
		</div>
	);
}

function FocalRow({
	rank,
	name,
	score,
	badges,
	onRowHover
}: {
	rank: number;
	name: string;
	score: number;
	badges: string[];
	onRowHover?: (hover: boolean) => void;
}) {
	return (
		<li
			className="flex items-start justify-between rounded-lg border border-transparent px-1 py-1 hover:bg-[color:var(--theme-hover-bg)]"
			onMouseEnter={() => onRowHover?.(true)}
			onMouseLeave={() => onRowHover?.(false)}
		>
			<div>
				<Text variant="caption" as="span" tone="muted">
					#{rank}
				</Text>{' '}
				<span className="font-medium">{name}</span>
				<div className="mt-0.5 flex flex-wrap gap-0.5">
					{badges.map((b) => (
						<Badge key={b} variant="secondary" className="px-1 py-0 text-xs">
							{b}
						</Badge>
					))}
				</div>
			</div>
			<Text variant="caption" as="span" tone="muted" className="tabular-nums">
				{score}
			</Text>
		</li>
	);
}
