import { useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { Theme } from './astrology-sidebar';
import { cn } from './ui/utils';
import { useAppFormFieldTheme } from './form-field-theme';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import type { ElementColors } from '@/lib/astrology/elementColors';
import type { AstrologyGlyphSetId } from '@/lib/astrology/glyphs';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import {
	HoroscopeWheel,
	type HemisphereOverlayKind,
	type HoroscopeWheelBody
} from './horoscope-wheel';

interface InformationViewProps {
	theme: Theme;
	glyphSet: AstrologyGlyphSetId;
	elementColors: ElementColors;
	lightPlanetFill: string;
}

type MicroBadgeId = 'lunar' | 'lights' | 'synodic';
type RetroPatternId = 'all-upper' | 'all-east' | null;
type HemiPreviewId = 'ew-east' | 'ew-west' | 'ns-north' | 'ns-south' | null;

function chipStateClass(
	locked: boolean,
	hover: boolean,
	base: string
): string {
	if (locked) return cn(base, 'border-primary bg-primary/10 text-foreground shadow-sm ring-2 ring-primary/25');
	if (hover) return cn(base, 'border-primary/50 bg-accent/80');
	return cn(base, 'border-border bg-card hover:bg-muted/60');
}

export function InformationView({ theme, glyphSet, elementColors, lightPlanetFill }: InformationViewProps) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme(theme);
	const isDark = theme === 'midnight' || theme === 'twilight';

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
		isDark ? 'bg-background text-foreground' : 'bg-background text-foreground'
	);

	const smallTitle = cn('text-xs font-semibold uppercase tracking-wide', ft.muted);
	const RailCard = ({ className, ...props }: ComponentProps<typeof Card>) => (
		<Card variant="themed" theme={theme} className={cn('gap-2 py-3 shadow-sm', className)} {...props} />
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
			<header
				data-handoff="TopBar"
				className="flex h-9 flex-shrink-0 items-center border-b border-border px-4"
			>
				<span className={cn('text-sm font-medium', ft.title)}>{t('sidebar_information')}</span>
				<span className={cn('ml-2 text-xs', ft.muted)}>— syntéza & struktura (prototype)</span>
			</header>

			<div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2 pt-1">
				{/* LEFT RAIL — Struktura */}
				<ScrollArea
					data-handoff="LeftRail_Structure"
					className="h-full w-[min(100%,280px)] min-w-[240px] flex-shrink-0 pr-1"
				>
					<div className="flex flex-col gap-2 pb-2">
						<RailCard data-handoff="Card_ElementDominance">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Převaha živlu</CardTitle>
								<CardDescription className="text-xs">Legenda: počet planet · podíl</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 px-3">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-7 w-full">
										<TabsTrigger value="pos" className="text-[10px]">
											Pozitivní
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-[10px]">
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
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Převaha modu</CardTitle>
								<CardDescription className="text-xs">Kardinální / Fixní / Mutuální</CardDescription>
							</CardHeader>
							<CardContent className="px-3">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-7 w-full">
										<TabsTrigger value="pos" className="text-[10px]">
											Pozitivní
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-[10px]">
											Negativní
										</TabsTrigger>
									</TabsList>
									<TabsContent value="pos" className="mt-2">
										<StackedBar
											segments={[
												{ label: 'Kardinální', pct: 50, count: 5, className: 'bg-rose-500' },
												{ label: 'Fixní', pct: 30, count: 3, className: 'bg-sky-600' },
												{ label: 'Mutuální', pct: 20, count: 2, className: 'bg-emerald-500' }
											]}
											positive
										/>
									</TabsContent>
									<TabsContent value="neg" className="mt-2">
										<StackedBar
											segments={[
												{ label: 'Kardinální', pct: 0, count: 0, className: 'bg-rose-500' },
												{ label: 'Fixní', pct: 0, count: 0, className: 'bg-sky-600' },
												{ label: 'Mutuální', pct: 100, count: 0, className: 'bg-emerald-500' }
											]}
											positive={false}
										/>
										<p className="text-muted-foreground mt-1 text-[10px]">neobsazeno (outline)</p>
									</TabsContent>
								</Tabs>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_HouseTypeDominance">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Převaha v domech</CardTitle>
								<CardDescription className="text-xs">Aktivní / Reaktivní / Výsledné + heatmap I–XII</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 px-3">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-7 w-full">
										<TabsTrigger value="pos" className="text-[10px]">
											Pozitivní
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-[10px]">
											Negativní
										</TabsTrigger>
									</TabsList>
									<TabsContent value="pos" className="mt-2 space-y-2">
										<StackedBar
											segments={[
												{ label: 'Rohové', pct: 40, count: 4, className: 'bg-violet-500' },
												{ label: 'Následné', pct: 35, count: 3, className: 'bg-amber-500' },
												{ label: 'Koncové', pct: 25, count: 2, className: 'bg-slate-500' }
											]}
											positive
										/>
										<HouseHeatmap />
									</TabsContent>
									<TabsContent value="neg" className="mt-2 space-y-2">
										<StackedBar
											segments={[
												{ label: 'Rohové', pct: 0, count: 0, className: 'bg-violet-500' },
												{ label: 'Následné', pct: 0, count: 0, className: 'bg-amber-500' },
												{ label: 'Koncové', pct: 100, count: 0, className: 'bg-slate-500' }
											]}
											positive={false}
										/>
										<p className="text-muted-foreground text-[10px]">neobsazeno</p>
									</TabsContent>
								</Tabs>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Quadrants">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Kvadranty</CardTitle>
								<CardDescription className="text-xs">Q1–Q4 · podíl</CardDescription>
							</CardHeader>
							<CardContent className="px-3">
								<QuadrantDonut />
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Hemispheres">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Hemisféry</CardTitle>
								<CardDescription className="text-xs">
									Pouze planety (osy se nepočítají). Náhled overlay v centru při hoveru.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 px-3">
								<div>
									<p className={smallTitle}>Východ (ASC) vs Západ (DSC)</p>
									<div className="mt-1 flex gap-2">
										<button
											type="button"
											data-state={hemiGaugeHover === 'ew-east' ? 'hover-preview' : 'default'}
											className="bg-muted/50 hover:bg-muted flex-1 rounded-lg border border-transparent px-2 py-1.5 text-left text-[11px] transition-colors"
											onMouseEnter={() => setHemiGaugeHover('ew-east')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Východ <span className="text-muted-foreground">7/10 · 70 %</span>
										</button>
										<button
											type="button"
											data-state={hemiGaugeHover === 'ew-west' ? 'hover-preview' : 'default'}
											className="bg-muted/50 hover:bg-muted flex-1 rounded-lg border border-transparent px-2 py-1.5 text-left text-[11px] transition-colors"
											onMouseEnter={() => setHemiGaugeHover('ew-west')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Západ <span className="text-muted-foreground">3/10 · 30 %</span>
										</button>
									</div>
									<HemiBalanceBar leftPct={70} rightPct={30} />
								</div>
								<Separator />
								<div>
									<p className={smallTitle}>Nahoře (MC) vs Dole (IC)</p>
									<div className="mt-1 flex gap-2">
										<button
											type="button"
											data-state={hemiGaugeHover === 'ns-north' ? 'hover-preview' : 'default'}
											className="bg-muted/50 hover:bg-muted flex-1 rounded-lg border border-transparent px-2 py-1.5 text-left text-[11px] transition-colors"
											onMouseEnter={() => setHemiGaugeHover('ns-north')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Nahoře <span className="text-muted-foreground">6/10 · 60 %</span>
										</button>
										<button
											type="button"
											data-state={hemiGaugeHover === 'ns-south' ? 'hover-preview' : 'default'}
											className="bg-muted/50 hover:bg-muted flex-1 rounded-lg border border-transparent px-2 py-1.5 text-left text-[11px] transition-colors"
											onMouseEnter={() => setHemiGaugeHover('ns-south')}
											onMouseLeave={() => setHemiGaugeHover(null)}
										>
											Dole <span className="text-muted-foreground">4/10 · 40 %</span>
										</button>
									</div>
									<HemiBalanceBar leftPct={60} rightPct={40} />
								</div>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_ExtroIntro">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Extroverze / Introverze</CardTitle>
								<CardDescription className="text-xs">Dummy balance · orientace hemisfér</CardDescription>
							</CardHeader>
							<CardContent className="px-3">
								<div className="relative h-8 w-full overflow-hidden rounded-full border bg-muted/40">
									<div
										className="absolute top-0 left-0 h-full w-1/2 bg-sky-500/30"
										style={{ width: '58%' }}
									/>
									<div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
										58 % extro · 42 % intro
									</div>
								</div>
								<p className="text-muted-foreground mt-1 text-[10px]">
									Východní hemisféra + horní · dummy váha
								</p>
							</CardContent>
						</RailCard>
					</div>
				</ScrollArea>

				{/* CENTER */}
				<div
					data-handoff="Center_Horoscope"
					data-hemisphere-overlay={hemisphereOverlay}
					className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/30"
				>
					<div className="flex flex-shrink-0 flex-wrap items-start justify-end gap-1.5 px-2 pt-2">
						<Badge
							data-handoff="MicroBadge_LunarPhase"
							variant="outline"
							className={cn(
								'h-auto max-w-[200px] cursor-default px-2 py-1 text-[10px] leading-tight font-normal',
								microHover === 'lunar' && 'ring-2 ring-primary/30'
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
								'h-auto max-w-[200px] cursor-default px-2 py-1 text-[10px] leading-tight font-normal',
								microHover === 'lights' && 'ring-2 ring-primary/30'
							)}
							onMouseEnter={() => setMicroHover('lights')}
							onMouseLeave={() => setMicroHover(null)}
						>
							<span className="inline-flex flex-wrap items-center gap-0.5">
								<span>{'Světla & obzor:'}</span>
								<AstrologyGlyph
									glyphId="sun"
									glyphSet={glyphSet}
									fallback="☉"
									size={12}
									className="inline-block align-middle"
								/>
								<span>nad ·</span>
								<AstrologyGlyph
									glyphId="moon"
									glyphSet={glyphSet}
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
								'h-auto max-w-[210px] cursor-default px-2 py-1 text-[10px] leading-tight font-normal',
								microHover === 'synodic' && 'ring-2 ring-primary/30'
							)}
							onMouseEnter={() => setMicroHover('synodic')}
							onMouseLeave={() => setMicroHover(null)}
						>
							<span className="inline-flex flex-wrap items-center gap-0.5">
								<AstrologyGlyph
									glyphId="mercury"
									glyphSet={glyphSet}
									fallback="☿"
									size={12}
									className="inline-block align-middle"
								/>
								<span>Prometheus ·</span>
								<AstrologyGlyph
									glyphId="venus"
									glyphSet={glyphSet}
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
								theme={theme}
								glyphSet={glyphSet}
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
							<CardContent className="flex items-center justify-between gap-3 px-3 py-2">
								<div>
									<p className={cn('text-xs font-medium', ft.title)}>Tvarový diagram horoskopu</p>
									<p className="text-muted-foreground text-[11px]">Pattern: Bucket</p>
								</div>
								<div
									className="text-muted-foreground flex h-10 w-14 items-end justify-center gap-0.5 rounded-lg border border-dashed p-1"
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
				</div>

				{/* RIGHT RAIL */}
				<ScrollArea
					data-handoff="RightRail_DynamicsFoci"
					className="h-full w-[min(100%,340px)] min-w-[280px] flex-shrink-0 pr-1"
				>
					<div className="flex flex-col gap-2 pb-2">
						<RailCard data-handoff="Card_Aspects" className="gap-1">
							<CardHeader className="px-3 pt-3 pb-0">
								<div className="flex items-center justify-between gap-2">
									<CardTitle className={cn('text-sm', ft.title)}>Aspekty</CardTitle>
									<div className="flex items-center gap-2">
										<Switch
											id="dynamics-mode"
											checked={dynamicsMode}
											onCheckedChange={setDynamicsMode}
										/>
										<Label htmlFor="dynamics-mode" className="text-muted-foreground text-[10px]">
											Dynamika v kruhu
										</Label>
									</div>
								</div>
								<CardDescription className="text-xs">Přepínání histogramu · náhled v kruhu</CardDescription>
							</CardHeader>
							<CardContent className="px-3">
								<Tabs defaultValue="pos" className="w-full">
									<TabsList className="h-8 w-full">
										<TabsTrigger value="pos" className="text-[11px]">
											Pozitivní převaha
										</TabsTrigger>
										<TabsTrigger value="neg" className="text-[11px]">
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
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Konfigurace</CardTitle>
							</CardHeader>
							<CardContent className="px-3">
								<ScrollArea className="h-[100px] w-full rounded-lg border">
									<div className="flex flex-col gap-1 p-2">
										{configs.map((c) => (
											<button
												key={c.id}
												type="button"
												data-state={selectedConfig === c.id ? 'active' : 'default'}
												className={cn(
													'rounded-lg px-2 py-1 text-left text-[11px] transition-colors',
													selectedConfig === c.id
														? 'bg-primary/15 text-foreground font-medium'
														: 'hover:bg-muted'
												)}
												onClick={() => setSelectedConfig(c.id)}
											>
												{c.label}
											</button>
										))}
									</div>
								</ScrollArea>
								<div
									data-handoff="ConfigPreview_MiniDiagram"
									className="bg-muted/40 mt-2 flex h-16 items-center justify-center rounded-lg border border-dashed text-[10px] text-muted-foreground"
								>
									Preview: {configs.find((c) => c.id === selectedConfig)?.label ?? '—'}
								</div>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Stellium">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Stellium</CardTitle>
							</CardHeader>
							<CardContent className="space-y-1 px-3">
								<p className="text-sm font-medium">Stellium: 10. dům (3 planety)</p>
								<p className="text-muted-foreground flex items-center gap-1 text-[11px]">
									<AstrologyGlyph
										glyphId="sun"
										glyphSet={glyphSet}
										fallback="☉"
										size={14}
									/>
									<AstrologyGlyph
										glyphId="venus"
										glyphSet={glyphSet}
										fallback="♀"
										size={14}
									/>
									<AstrologyGlyph
										glyphId="jupiter"
										glyphSet={glyphSet}
										fallback="♃"
										size={14}
									/>
								</p>
							</CardContent>
						</RailCard>

						<RailCard
							data-handoff="Card_SingletonHemisphere"
							onMouseEnter={() => setSingletonHover(true)}
							onMouseLeave={() => setSingletonHover(false)}
						>
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Singleton v hemisféře</CardTitle>
							</CardHeader>
							<CardContent className="px-3">
								<p className="text-[12px] leading-snug">
									Singleton: <span className="font-medium">Saturn</span> – Východní hemisféra
								</p>
								<p className="text-muted-foreground mt-1 text-[10px]">
									Hover: halo planety + hemisférický overlay (ASC–DSC)
								</p>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_Retrograde">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Retrogradita</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 px-3">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-sm">Retrográdní planety: 5/10</span>
									<Badge variant="secondary" className="text-[10px]">
										výrazná
									</Badge>
								</div>
								<p className={smallTitle}>Retrográdní vzorce</p>
								<button
									type="button"
									className="hover:bg-muted w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-[11px]"
									onMouseEnter={() => setRetroPatternHover('all-upper')}
									onMouseLeave={() => setRetroPatternHover(null)}
								>
									Všechny planety nahoře retrográdní → náhled MC hemisféra
								</button>
								<button
									type="button"
									className="hover:bg-muted w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-[11px]"
									onMouseEnter={() => setRetroPatternHover('all-east')}
									onMouseLeave={() => setRetroPatternHover(null)}
								>
									Všechny planety na východě retrográdní → náhled ASC hemisféra
								</button>
							</CardContent>
						</RailCard>

						<RailCard data-handoff="Card_FocalPlanets">
							<CardHeader className="px-3 pt-3 pb-0">
								<CardTitle className={cn('text-sm', ft.title)}>Ohniskové planety</CardTitle>
								<CardDescription className="text-xs">Unified focus panel · filtry (multi)</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 px-3">
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
											className="hover:bg-muted cursor-default px-1.5 py-0 text-[9px]"
											onMouseEnter={() =>
												setFocalFilterHover(label === 'Neaspektovaná' ? 'una' : null)
											}
											onMouseLeave={() => setFocalFilterHover(null)}
										>
											{label}
										</Badge>
									))}
								</div>
								<ul className="space-y-2 text-[11px]">
									<FocalRow
										rank={1}
										name="Saturn"
										score={92}
										badges={['FD', 'Ruler', 'Lead']}
									/>
									<FocalRow rank={2} name="Mars" score={84} badges={['Angular', 'Trigger']} />
									<FocalRow
										rank={3}
										name="Merkur"
										score={71}
										badges={['Una', 'Cutting']}
										onRowHover={(h) => setFocalFilterHover(h ? 'una' : null)}
									/>
								</ul>
								<p className="text-muted-foreground text-[10px]">
									Una: při aktivaci zvýraznit planetu bez hlavních aspektů v kruhu (koncept).
								</p>
							</CardContent>
						</RailCard>
					</div>
				</ScrollArea>
			</div>

			{/* BOTTOM HIGHLIGHTS */}
			<div
				data-handoff="BottomHighlights"
				className="flex h-11 flex-shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-muted/20 px-2"
			>
				{bottomChips.map((c) => {
					const locked = lockedChipId === c.id;
					const hover = hoverChipId === c.id;
					return (
						<button
							key={c.id}
							type="button"
							data-state={
								locked ? 'locked-focus' : hover ? 'hover-preview' : 'default'
							}
							className={chipStateClass(
								locked,
								hover,
								'shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors'
							)}
							onMouseEnter={() => setHoverChipId(c.id)}
							onMouseLeave={() => setHoverChipId(null)}
							onClick={() => setLockedChipId((prev) => (prev === c.id ? null : c.id))}
						>
							{c.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function ElementBars({ positive }: { positive: boolean }) {
	const rows = [
		{ label: 'Oheň', n: 4, pct: 40, c: 'bg-orange-500' },
		{ label: 'Země', n: 2, pct: 20, c: 'bg-amber-700' },
		{ label: 'Vzduch', n: 3, pct: 30, c: 'bg-sky-500' },
		{ label: 'Voda', n: 1, pct: 10, c: 'bg-blue-600' }
	];
	if (!positive) {
		return (
			<div className="flex h-16 items-end justify-between gap-1">
				{rows.map((r) => (
					<div key={r.label} className="flex flex-1 flex-col items-center gap-0.5">
						<div
							className={cn(
								'w-full rounded-t-lg border-2 border-dashed border-muted-foreground/40',
								r.n === 0 ? 'h-[72%]' : 'h-[8%]'
							)}
						/>
						<span className="text-[9px] text-muted-foreground">0</span>
						<span className="text-[9px]">{r.label}</span>
					</div>
				))}
			</div>
		);
	}
	return (
		<div className="flex h-20 items-end justify-between gap-1">
			{rows.map((r) => (
				<div key={r.label} className="flex flex-1 flex-col items-center gap-0.5">
					<div className={cn('w-full rounded-t-lg', r.c)} style={{ height: `${r.pct}%` }} />
					<span className="text-[10px] font-medium">
						{r.n} · {r.pct}%
					</span>
					<span className="text-muted-foreground text-[9px]">{r.label}</span>
				</div>
			))}
		</div>
	);
}

function StackedBar({
	segments,
	positive
}: {
	segments: { label: string; pct: number; count: number; className: string }[];
	positive: boolean;
}) {
	return (
		<div>
			<div className="flex h-3 w-full overflow-hidden rounded-full border bg-muted">
				{segments.map((s) => (
					<div
						key={s.label}
						style={{ width: `${s.pct}%` }}
						className={cn(
							positive ? s.className : 'border border-dashed bg-transparent',
							!positive && s.pct === 0 && 'border-muted-foreground/30'
						)}
						title={s.label}
					/>
				))}
			</div>
			<div className="text-muted-foreground mt-1 flex justify-between text-[9px]">
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
					className="flex aspect-square items-center justify-center rounded-lg border text-[8px]"
					style={{ backgroundColor: `rgba(59, 130, 246, ${0.15 + v * 0.5})` }}
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
						'conic-gradient(#f43f5e 0% 28%, #0ea5e9 28% 52%, #10b981 52% 74%, #8b5cf6 74% 100%)'
				}}
			/>
			<div className="grid flex-1 grid-cols-2 gap-1 text-[10px]">
				{parts.map((p) => (
					<div key={p.q} className="flex items-center justify-between rounded-lg border px-1 py-0.5">
						<span>{p.q}</span>
						<span className="text-muted-foreground">{p.pct}%</span>
					</div>
				))}
			</div>
		</div>
	);
}

function HemiBalanceBar({ leftPct, rightPct }: { leftPct: number; rightPct: number }) {
	return (
		<div className="bg-muted mt-1 h-2 w-full overflow-hidden rounded-full">
			<div
				className="bg-primary/70 h-full rounded-l-full transition-all"
				style={{ width: `${leftPct}%` }}
			/>
		</div>
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
					<span className="text-muted-foreground w-20 text-[10px]">{r.k}</span>
					<div className="bg-muted h-5 flex-1 overflow-hidden rounded-md">
						<div
							className="bg-primary/80 h-full rounded-r"
							style={{ width: `${(r.n / max) * 100}%` }}
						/>
					</div>
					<span className="w-4 text-[10px] tabular-nums">{r.n}</span>
					{r.star && <Star className="text-amber-500 h-3 w-3 fill-amber-400" />}
				</div>
			))}
		</div>
	);
}

function AspectNegativeAbsence() {
	const rows = [
		{ k: 'Kardinální modalita (osy)', n: 0 },
		{ k: 'Živel Voda (osy)', n: 0 },
		{ k: 'Konjunkce (slabé)', n: 1 }
	];
	return (
		<div className="space-y-2">
			{rows.map((r) => (
				<div key={r.k} className="flex items-center gap-2">
					<span className="text-muted-foreground w-28 text-[10px] leading-tight">{r.k}</span>
					<div className="bg-muted/30 h-4 flex-1 rounded-lg border border-dashed" />
					<span className="text-muted-foreground w-6 text-[10px]">0</span>
				</div>
			))}
			<p className="text-muted-foreground text-[10px]">Neobsazenost · neutrální styl</p>
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
			className="hover:bg-muted/50 flex items-start justify-between rounded-lg border border-transparent px-1 py-1"
			onMouseEnter={() => onRowHover?.(true)}
			onMouseLeave={() => onRowHover?.(false)}
		>
			<div>
				<span className="text-muted-foreground text-[10px]">#{rank}</span>{' '}
				<span className="font-medium">{name}</span>
				<div className="mt-0.5 flex flex-wrap gap-0.5">
					{badges.map((b) => (
						<Badge key={b} variant="secondary" className="px-1 py-0 text-[8px]">
							{b}
						</Badge>
					))}
				</div>
			</div>
			<span className="text-muted-foreground text-[10px] tabular-nums">{score}</span>
		</li>
	);
}
