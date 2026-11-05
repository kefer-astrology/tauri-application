import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { OverflowMenu } from './overflow-menu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('OverflowMenu', () => {
	it('opens on click, moves with arrow keys, and closes after choosing', async () => {
		const remove = vi.fn();
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		await act(async () =>
			root.render(
				<OverflowMenu
					label="Astrolabe options"
					items={[
						{ id: 'settings', label: 'Settings', onSelect: vi.fn() },
						{ id: 'remove', label: 'Remove from workspace', onSelect: remove }
					]}
				/>
			)
		);
		const trigger = container.querySelector('button[aria-label="Astrolabe options"]')!;
		expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
		await act(async () => (trigger as HTMLElement).click());
		const items = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
		expect(items.map((b) => b.textContent)).toEqual(['Settings', 'Remove from workspace']);

		items[0]!.focus();
		await act(async () => {
			document
				.querySelector('[role="menu"]')!
				.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		});
		expect(document.activeElement).toBe(items[1]);

		await act(async () => items[1]!.click());
		expect(remove).toHaveBeenCalledTimes(1);
		expect(document.querySelector('[role="menu"]')).toBeNull();
		await act(async () => root.unmount());
		container.remove();
	});
});
