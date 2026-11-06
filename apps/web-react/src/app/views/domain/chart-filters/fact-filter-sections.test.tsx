import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { emptyAngularPlanetFilter, type FactFilters } from '@/lib/astrology/factFilters';
import { AngularPlanetFilter } from './fact-filter-sections';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('adds and removes angular planet rows while preserving existing conditions', async () => {
	function Harness() {
		const [value, setValue] = useState<FactFilters['angular']>([
			{ ...emptyAngularPlanetFilter(1), planet: 'mars', axis: 'asc' }
		]);
		return (
			<>
				<AngularPlanetFilter value={value} onChange={setValue} />
				<output>{JSON.stringify(value)}</output>
			</>
		);
	}
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () => root.render(<Harness />));
		const rows = () => container.querySelectorAll('[role="combobox"]').length / 2;
		const removeButtons = () =>
			container.querySelectorAll<HTMLButtonElement>('[aria-label="open_filter_remove_condition"]');
		expect(rows()).toBe(1);
		expect(removeButtons()[0].disabled).toBe(true);
		const add = [...container.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('open_filter_add_condition')
		)!;
		await act(async () => add.click());
		expect(rows()).toBe(2);
		expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual([
			{ id: 1, planet: 'mars', axis: 'asc' },
			emptyAngularPlanetFilter(2)
		]);
		await act(async () => removeButtons()[1].click());
		expect(rows()).toBe(1);
		expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual([
			{ id: 1, planet: 'mars', axis: 'asc' }
		]);
		expect(removeButtons()[0].disabled).toBe(true);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
