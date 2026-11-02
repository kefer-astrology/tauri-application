import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChartWorkspaceLayout } from './chart-workspace-layout';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function withLayout(
	width: number,
	check: (container: HTMLDivElement, resize: (width: number) => Promise<void>) => Promise<void>
) {
	let measuredWidth = width;
	let onResize = () => {};
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => ({ width: measuredWidth }) as DOMRect
	);
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				onResize = callback;
			}
			observe() {}
			disconnect() {}
		}
	);
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<ChartWorkspaceLayout
					detailsLabel="Details"
					positionsLabel="Positions"
					details={<div data-test-panel="details">Chart details</div>}
					positions={<div data-test-panel="positions">Chart positions</div>}
				>
					<div data-test-wheel>Wheel</div>
				</ChartWorkspaceLayout>
			)
		);
		await check(container, async (next) => {
			measuredWidth = next;
			await act(async () => onResize());
		});
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
}

describe('chart workspace panels', () => {
	it('always shows both desktop panels without toggle buttons', async () => {
		await withLayout(1200, async (container) => {
			expect(container.querySelectorAll('aside')).toHaveLength(2);
			expect(container.querySelector('[data-test-panel="details"]')).not.toBeNull();
			expect(container.querySelector('[data-test-panel="positions"]')).not.toBeNull();
			expect(container.querySelector('[data-chart-panel-trigger]')).toBeNull();
		});
	});

	it('only hides details on compact layouts and keeps positions mounted while resizing', async () => {
		await withLayout(280, async (container, resize) => {
			const positions = container.querySelector('[data-test-panel="positions"]');
			expect(positions).not.toBeNull();
			expect(container.querySelector('[data-test-panel="details"]')).toBeNull();
			expect(container.querySelector('[data-chart-panel-trigger="positions"]')).toBeNull();
			await act(async () =>
				container.querySelector<HTMLButtonElement>('[data-chart-panel-trigger="details"]')!.click()
			);
			expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Chart details');
			expect(document.querySelectorAll('[data-test-panel="details"]')).toHaveLength(1);
			await resize(1200);
			expect(document.querySelector('[role="dialog"]')).toBeNull();
			expect(container.querySelectorAll('aside')).toHaveLength(2);
			await resize(280);
			expect(document.querySelector('[role="dialog"]')).toBeNull();
			expect(container.querySelector('[data-test-panel="details"]')).toBeNull();
			expect(container.querySelector('[data-test-panel="positions"]')).toBe(positions);
		});
	});
});
