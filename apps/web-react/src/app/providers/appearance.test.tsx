import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { AppearanceProvider, useAppearance } from './appearance';
import { useAppTheme } from './app-theme';

function Controls() {
	const appearance = useAppearance();
	const { dark } = useAppTheme();
	return (
		<>
			<output>{dark ? 'dark' : 'light'}</output>
			<button
				id="dark-canvas"
				onClick={() =>
					appearance.commitThemePalette({
						...appearance.themePalette,
						canvasStart: '#121212',
						canvasEnd: '#242424',
						accent: '#aaff00'
					})
				}
			>
				Dark canvas
			</button>
			<button id="midnight" onClick={() => appearance.setTheme('midnight')}>
				Midnight
			</button>
			<button
				id="light-canvas"
				onClick={() =>
					appearance.commitThemePalette({
						...appearance.themePalette,
						canvasStart: '#ffffff',
						canvasEnd: '#fafafa'
					})
				}
			>
				Light canvas
			</button>
		</>
	);
}

it('updates root tokens, native controls and chart context when a custom canvas changes brightness', async () => {
	const previousStorage = localStorage.getItem('kefer_theme_palettes_v1');
	const rootElement = document.documentElement;
	const previousStyle = rootElement.getAttribute('style');
	const previousClass = rootElement.className;
	localStorage.removeItem('kefer_theme_palettes_v1');
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<AppearanceProvider>
					<Controls />
				</AppearanceProvider>
			)
		);
		expect(container.querySelector('output')?.textContent).toBe('light');
		await act(async () => container.querySelector<HTMLButtonElement>('#dark-canvas')!.click());
		expect(rootElement.classList.contains('dark')).toBe(true);
		expect(container.querySelector('output')?.textContent).toBe('dark');
		expect(rootElement.style.getPropertyValue('color-scheme')).toBe('dark');
		expect(rootElement.style.getPropertyValue('--theme-canvas-end')).toBe('#242424');
		expect(rootElement.style.getPropertyValue('--theme-accent-foreground')).toBe('#000000');
		await act(async () => container.querySelector<HTMLButtonElement>('#midnight')!.click());
		await act(async () => container.querySelector<HTMLButtonElement>('#light-canvas')!.click());
		expect(rootElement.classList.contains('dark')).toBe(false);
		expect(container.querySelector('output')?.textContent).toBe('light');
		expect(rootElement.style.getPropertyValue('color-scheme')).toBe('light');
	} finally {
		await act(async () => root.unmount());
		container.remove();
		if (previousStyle === null) rootElement.removeAttribute('style');
		else rootElement.setAttribute('style', previousStyle);
		rootElement.className = previousClass;
		if (previousStorage === null) localStorage.removeItem('kefer_theme_palettes_v1');
		else localStorage.setItem('kefer_theme_palettes_v1', previousStorage);
	}
});
