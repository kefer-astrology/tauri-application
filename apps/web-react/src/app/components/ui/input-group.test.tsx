import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { enUS } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';
import { InputGroup, InputGroupButton, InputGroupInput } from './input-group';
import { DatePickerInput } from './date-picker-input';
import { TimeRollerPicker } from './time-roller-picker';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('shared picker input group', () => {
	it('disables the input and attached action together', async () => {
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		const onClick = vi.fn();
		try {
			await act(async () =>
				root.render(
					<InputGroup disabled>
						<InputGroupInput aria-label="Date" />
						<InputGroupButton onClick={onClick}>Choose date</InputGroupButton>
					</InputGroup>
				)
			);
			expect(container.querySelector('input')?.disabled).toBe(true);
			expect(container.querySelector('button')?.disabled).toBe(true);
			await act(async () => container.querySelector('button')!.click());
			expect(onClick).not.toHaveBeenCalled();
		} finally {
			await act(async () => root.unmount());
			container.remove();
		}
	});

	it.each(['date', 'time'])('opens the %s picker through its attached action', async (kind) => {
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		const value = new Date(2026, 10, 2, 12, 30, 15);
		try {
			await act(async () =>
				root.render(
					kind === 'date' ? (
						<DatePickerInput label="Date" value={value} onValueChange={() => {}} locale={enUS} />
					) : (
						<TimeRollerPicker label="Time" value={value} onValueChange={() => {}} />
					)
				)
			);
			await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
			expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
			expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
		} finally {
			await act(async () => root.unmount());
			container.remove();
		}
	});
});
