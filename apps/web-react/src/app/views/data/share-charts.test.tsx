import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
	BalanceBar,
	HeatGrid,
	ShareColumns,
	ShareDonut,
	ShareRows,
	StackedShareBar,
	type ShareItem
} from './share-charts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items: ShareItem[] = [
	{ id: 'fire', label: 'Fire', count: 4, share: 0.4, color: '#f00' },
	{ id: 'water', label: 'Water', count: 0, share: 0, color: '#00f' }
];

describe('share charts', () => {
	it('draw counts, shares and labels', () => {
		const html = renderToString(
			<>
				<ShareColumns items={items} />
				<StackedShareBar items={items} />
				<ShareDonut items={items} />
				<ShareRows items={items} />
				<HeatGrid cells={[{ id: 'h1', label: 'I', value: 2 }]} />
				<BalanceBar
					left={{ label: 'Extraversion', share: 0.8 }}
					right={{ label: 'Introversion', share: 0.2 }}
				/>
			</>
		);
		expect(html).toContain('Fire');
		expect(html).toContain('40 %');
		expect(html).toContain('conic-gradient');
		expect(html).toContain('Extraversion');
		expect(html).toContain('80 %');
	});

	it('preview on hover and focus, select on click, and mark the active item', () => {
		const hover = vi.fn();
		const select = vi.fn();
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		act(() =>
			root.render(
				<ShareColumns items={items} activeId="fire" onItemHover={hover} onItemSelect={select} />
			)
		);
		const [fire, water] = [...container.querySelectorAll('button')];
		expect(fire!.getAttribute('aria-pressed')).toBe('true');
		expect(water!.getAttribute('aria-pressed')).toBe('false');
		act(() => {
			water!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		});
		expect(hover).toHaveBeenLastCalledWith('water');
		act(() => water!.click());
		expect(select).toHaveBeenCalledWith('water');
		act(() => root.unmount());
		container.remove();
	});
});
