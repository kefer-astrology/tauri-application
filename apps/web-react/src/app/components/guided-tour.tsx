import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';

type TourStep = {
	target: string;
	title: string;
	body: string;
	activate?: boolean;
	activateTarget?: string;
};

type TourScenarioId = 'quickstart' | 'radix' | 'transits' | 'settings';

type TourScenario = {
	label: string;
	steps: TourStep[];
};

const tourScenarios: Record<TourScenarioId, TourScenario> = {
	quickstart: {
		label: 'Quickstart',
		steps: [
			{
				target: '[data-tour="app-shell"]',
				title: 'Welcome to Kefer Astrology',
				body: 'The primary sidebar keeps chart actions, specialised views, settings, and appearance controls within reach.'
			},
			{
				target: '[data-tour="nav-novy"]',
				title: 'Create a chart',
				body: 'New opens the chart form for a subject, date, time, location, and calculation options.',
				activate: true
			},
			{
				target: '[data-tour="nav-horoskop"]',
				title: 'Return to the horoscope',
				body: 'Horoscope is the main dashboard for the selected chart and its visual interpretation.',
				activate: true
			},
			{
				target: '[data-tour="nav-otevrit"]',
				title: 'Continue existing work',
				body: 'Open loads a desktop workspace. In this browser demonstration, native folder selection remains unavailable.'
			},
			{
				target: '[data-tour="theme-switcher"]',
				title: 'Choose an atmosphere',
				body: 'Switch between the four visual themes here, then continue exploring freely.'
			}
		]
	},
	radix: {
		label: 'Radix features',
		steps: [
			{
				target: '[data-tour="nav-horoskop"]',
				title: 'Open the radix workspace',
				body: 'Horoscope opens the complete radix dashboard for the selected chart.',
				activate: true
			},
			{
				target: '[data-tour="radix-profile"]',
				title: 'Chart profile',
				body: 'The profile keeps the chart identity, event time, location, coordinates, house system, and edit action together.'
			},
			{
				target: '[data-tour="radix-astrolabe"]',
				title: 'Astrolabe',
				body: 'Choose a step size and unit, then move backward or forward to preview the chart at another moment.'
			},
			{
				target: '[data-tour="radix-wheel"]',
				title: 'Radix wheel',
				body: 'The wheel combines zodiac, houses, axes, bodies, and computed aspects without inventing missing backend data.'
			},
			{
				target: '[data-tour="radix-positions"]',
				title: 'Computed positions',
				body: 'This report lists selected objects with sign position and retrograde state. Its edit action controls the object set.'
			},
			{
				target: '[data-tour="radix-chart-tabs"]',
				title: 'Chart context',
				body: 'The bottom strip switches between charts in the current workspace and indicates temporary previews.'
			}
		]
	},
	transits: {
		label: 'Transit computation',
		steps: [
			{
				target: '[data-tour="nav-tranzity"]',
				title: 'Open transit computation',
				body: 'Transits compares a source radix with another moment or a time range.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-general"]',
				title: 'General setup',
				body: 'Choose the transit mode, period, source chart, and time boundary before calculating.',
				activate: true
			},
			{
				target: '[data-tour="transits-period"]',
				title: 'Define the period',
				body: 'Use the current moment for an instant overlay or define a custom range for a transit series.',
				activateTarget: '[data-tour="secondary-nav-general"]'
			},
			{
				target: '[data-tour="secondary-nav-transiting-bodies"]',
				title: 'Transiting bodies',
				body: 'Select the moving bodies whose positions will be computed.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-transited-bodies"]',
				title: 'Transited bodies',
				body: 'Choose which radix bodies receive aspects from the moving bodies.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-aspects"]',
				title: 'Aspects used',
				body: 'Select the aspect types included in transit detection.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-general"]',
				title: 'Return to calculation',
				body: 'Return to General after defining bodies and aspects.',
				activate: true
			},
			{
				target: '[data-tour="transits-calculate"]',
				title: 'Calculate',
				body: 'The desktop application sends this configuration through the shared Tauri transit contract. The tour does not submit it.'
			}
		]
	},
	settings: {
		label: 'Settings',
		steps: [
			{
				target: '[data-tour="nav-nastaveni"]',
				title: 'Open settings',
				body: 'Settings combines interface preferences and workspace calculation defaults.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-jazyk"]',
				title: 'Language',
				body: 'Choose the interface language from the shared translation set.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-lokace"]',
				title: 'Default location',
				body: 'Set the location, coordinates, and timezone used as workspace defaults.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-system_domu"]',
				title: 'House system',
				body: 'Choose the default house system supported by the current computation backend.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-pozorovane_objekty"]',
				title: 'Observable objects',
				body: 'Control which bodies and calculated points are included by default.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-nastaveni_aspektu"]',
				title: 'Aspect settings',
				body: 'Enable aspect types and define their default orbs and colours.',
				activate: true
			},
			{
				target: '[data-tour="secondary-nav-vzhled"]',
				title: 'Appearance',
				body: 'Choose icon and glyph families, theme palettes, and element colours.',
				activate: true
			},
			{
				target: '[data-tour="theme-switcher"]',
				title: 'Quick theme switcher',
				body: 'The primary sidebar provides immediate access to all four application themes.'
			}
		]
	}
};

function requestedScenarioId(): TourScenarioId | null {
	if (typeof window === 'undefined') return null;
	const requested = new URLSearchParams(window.location.search).get('tour');
	return requested && requested in tourScenarios ? (requested as TourScenarioId) : null;
}

export function GuidedTour() {
	const [scenarioId] = useState(requestedScenarioId);
	const [isOpen, setIsOpen] = useState(() => scenarioId !== null);
	const [stepIndex, setStepIndex] = useState(0);
	const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
	const scenario = scenarioId ? tourScenarios[scenarioId] : null;
	const steps = scenario?.steps ?? [];
	const step = steps[stepIndex];

	useEffect(() => {
		if (!isOpen || !step) return;

		const target = document.querySelector<HTMLElement>(step.target);
		if (step.activateTarget) {
			document.querySelector<HTMLElement>(step.activateTarget)?.click();
		}
		if (step.activate) target?.click();

		const updateTarget = () => {
			const currentTarget = document.querySelector<HTMLElement>(step.target);
			if (!currentTarget) {
				setTargetRect(null);
				return;
			}
			setTargetRect(currentTarget.getBoundingClientRect());
		};

		const frame = window.requestAnimationFrame(updateTarget);
		window.addEventListener('resize', updateTarget);
		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', updateTarget);
		};
	}, [isOpen, step]);

	useEffect(() => {
		if (!isOpen || steps.length === 0) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsOpen(false);
			if (event.key === 'ArrowRight') {
				setStepIndex((current) => Math.min(current + 1, steps.length - 1));
			}
			if (event.key === 'ArrowLeft') setStepIndex((current) => Math.max(current - 1, 0));
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, steps.length]);

	const cardPosition = useMemo(() => {
		if (!targetRect) {
			return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
		}
		const cardWidth = Math.min(340, window.innerWidth - 32);
		const rightSideLeft = targetRect.right + 20;
		const leftSideLeft = targetRect.left - cardWidth - 20;
		const preferredLeft =
			window.innerWidth - rightSideLeft >= cardWidth ? rightSideLeft : leftSideLeft;
		const left = Math.min(Math.max(16, preferredLeft), window.innerWidth - cardWidth - 16);
		const top = Math.min(Math.max(16, targetRect.top), window.innerHeight - 260);
		return { left, top, width: cardWidth };
	}, [targetRect]);

	if (!isOpen || !scenario || !step) return null;

	const closeTour = () => {
		setIsOpen(false);
		const url = new URL(window.location.href);
		url.searchParams.delete('tour');
		window.history.replaceState({}, '', url);
	};

	return (
		<div className="pointer-events-none fixed inset-0 z-[100]" aria-live="polite">
			{targetRect && (
				<div
					className="fixed rounded-lg border-2 border-white shadow-[0_0_0_9999px_rgba(11,9,8,0.62)] transition-all duration-200"
					style={{
						left: targetRect.left - 5,
						top: targetRect.top - 5,
						width: targetRect.width + 10,
						height: targetRect.height + 10
					}}
				/>
			)}
			<section
				role="dialog"
				aria-label={`${scenario.label} guided tour`}
				className="pointer-events-auto fixed rounded-xl border border-white/20 bg-neutral-950 p-5 text-white shadow-2xl"
				style={cardPosition}
			>
				<div className="mb-3 flex items-center justify-between gap-4 text-xs text-neutral-400">
					<span>{scenario.label.toUpperCase()}</span>
					<span>
						{stepIndex + 1} / {steps.length}
					</span>
				</div>
				<h2 className="mb-2 text-lg font-semibold">{step.title}</h2>
				<p className="text-sm leading-6 text-neutral-300">{step.body}</p>
				<div className="mt-5 flex items-center justify-between gap-3">
					<Button variant="ghost" onClick={closeTour} className="text-neutral-300 hover:text-white">
						Exit
					</Button>
					<div className="flex gap-2">
						<Button
							variant="outline"
							disabled={stepIndex === 0}
							onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
						>
							Back
						</Button>
						<Button
							onClick={() => {
								if (stepIndex === steps.length - 1) closeTour();
								else setStepIndex((current) => current + 1);
							}}
						>
							{stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
