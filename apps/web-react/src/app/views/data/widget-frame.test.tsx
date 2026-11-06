import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { AppThemeProvider } from '@/app/providers/app-theme';
import { WidgetFrame } from './widget-frame';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('WidgetFrame', () => {
	it('collapses and expands its body from a real button, keeping it mounted', () => {
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		act(() =>
			root.render(
				<AppThemeProvider theme="noon" glyphSet="default">
					<WidgetFrame title="Astrolabe" dataTour="radix-astrolabe" actions={<span>action</span>}>
						<input aria-label="inside" defaultValue="kept" />
					</WidgetFrame>
				</AppThemeProvider>
			)
		);
		const toggle = container.querySelector('button[aria-expanded]') as HTMLButtonElement;
		const body = document.getElementById(toggle.getAttribute('aria-controls')!)!;
		expect(container.querySelector('[data-tour="radix-astrolabe"]')).not.toBeNull();
		expect(toggle.textContent).toContain('Astrolabe');
		expect(container.textContent).toContain('action');
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(body.hidden).toBe(false);

		act(() => toggle.click());
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(body.hidden).toBe(true);
		expect((container.querySelector('input') as HTMLInputElement).value).toBe('kept');

		act(() => toggle.click());
		expect(body.hidden).toBe(false);
		act(() => root.unmount());
		container.remove();
	});
});
