import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RadioGroup, RadioGroupItem } from './radio-group';

describe('RadioGroup', () => {
	it('checks the item matching the value and shares the name', () => {
		const html = renderToString(
			<RadioGroup name="scope" value="b" onValueChange={() => {}}>
				<RadioGroupItem value="a" />
				<RadioGroupItem value="b" />
			</RadioGroup>
		);
		expect(html).toContain('role="radiogroup"');
		expect(html.match(/name="scope"/g)).toHaveLength(2);
		const inputs = html.match(/<input[^>]*>/g) ?? [];
		const checkedValues = inputs
			.filter((input) => / checked=""/.test(input))
			.map((input) => /value="([^"]*)"/.exec(input)?.[1]);
		expect(checkedValues).toEqual(['b']);
	});

	it('requires a surrounding group', () => {
		expect(() => renderToString(<RadioGroupItem value="a" />)).toThrow(/within RadioGroup/);
	});
});
