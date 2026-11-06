import { act, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceButton, ChoiceLabel, Chip } from './choice';
import { Checkbox } from './checkbox';
import { Button } from './button';
import { SegmentedControl } from './segmented-control';
import { ModeSwitcher } from './mode-switcher';

async function withView(view: ReactNode, check: (container: HTMLDivElement) => Promise<void>) {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () => root.render(view));
		await check(container);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
}

const options = [
	{ value: 'a', label: 'A' },
	{ value: 'b', label: 'B' }
];

describe('shared choice controls', () => {
	it('preserves selecting and clearing a segmented option', async () => {
		function Harness() {
			const [value, setValue] = useState('a');
			return (
				<SegmentedControl
					value={value}
					onValueChange={setValue}
					options={options}
					ariaLabel="Selection"
					allowDeselect
					emptyValue=""
				/>
			);
		}
		await withView(<Harness />, async (container) => {
			const buttons = container.querySelectorAll('button');
			await act(async () => buttons[0].click());
			expect([...buttons].map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
			await act(async () => buttons[1].click());
			expect([...buttons].map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
		});
	});

	it('keeps label activation associated with one checkbox change', async () => {
		const onChange = vi.fn();
		function Harness() {
			const [checked, setChecked] = useState(false);
			return (
				<ChoiceLabel htmlFor="choice-check" selected={checked}>
					<Checkbox
						id="choice-check"
						checked={checked}
						onCheckedChange={(next) => {
							onChange(next);
							setChecked(next === true);
						}}
					/>
					Earth
				</ChoiceLabel>
			);
		}
		await withView(<Harness />, async (container) => {
			await act(async () => container.querySelector('label')!.click());
			expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
			expect(container.querySelector('[role="checkbox"]')?.getAttribute('aria-checked')).toBe(
				'true'
			);
		});
	});

	it('does not activate a disabled checkbox choice', async () => {
		const onChange = vi.fn();
		await withView(
			<ChoiceLabel htmlFor="disabled-check" disabled>
				<Checkbox id="disabled-check" disabled onCheckedChange={onChange} />
				Unavailable
			</ChoiceLabel>,
			async (container) => {
				await act(async () => container.querySelector('label')!.click());
				expect(onChange).not.toHaveBeenCalled();
			}
		);
	});

	it('uses option semantics separately from toggle semantics and passive chips', async () => {
		const onRemove = vi.fn();
		await withView(
			<>
				<ChoiceButton role="option" selected>
					Option
				</ChoiceButton>
				<ChoiceButton selected={false} preview>
					Preview
				</ChoiceButton>
				<Chip selected>
					Tag
					<Button type="button" onClick={onRemove}>
						Remove tag
					</Button>
				</Chip>
			</>,
			async (container) => {
				const option = container.querySelector('[role="option"]')!;
				expect(option.getAttribute('aria-selected')).toBe('true');
				expect(option.hasAttribute('aria-pressed')).toBe(false);
				expect(container.querySelectorAll('button')).toHaveLength(3);
				expect(container.querySelectorAll('button')[1].getAttribute('aria-pressed')).toBe('false');
				await act(async () => container.querySelectorAll('button')[2].click());
				expect(onRemove).toHaveBeenCalledOnce();
			}
		);
	});

	it('keeps mode labels and the switch synchronized', async () => {
		function Harness() {
			const [value, setValue] = useState('a');
			return (
				<ModeSwitcher value={value} onValueChange={setValue} options={options} ariaLabel="Mode" />
			);
		}
		await withView(<Harness />, async (container) => {
			await act(async () =>
				container.querySelector<HTMLButtonElement>('[aria-pressed="false"]')!.click()
			);
			expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
			await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
			expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe(
				'false'
			);
			expect(container.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
		});
	});
});
