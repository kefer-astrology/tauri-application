import * as React from 'react';

import { cn } from './utils';

type RadioGroupContextValue = {
	name: string;
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

/** Single choice among `RadioGroupItem`s: native radios sharing `name`, so arrow keys and form
 *  semantics work as usual. Lay the items out with `className` / children. */
function RadioGroup({
	name,
	value,
	onValueChange,
	disabled,
	className,
	...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & RadioGroupContextValue) {
	const context = React.useMemo(
		() => ({ name, value, onValueChange, disabled }),
		[name, value, onValueChange, disabled]
	);
	return (
		<RadioGroupContext.Provider value={context}>
			<div data-slot="radio-group" role="radiogroup" className={className} {...props} />
		</RadioGroupContext.Provider>
	);
}

/** One option of the surrounding `RadioGroup`; put it inside a `<label>` with its text. */
function RadioGroupItem({
	value,
	className,
	disabled,
	...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'name' | 'checked' | 'onChange' | 'value'> & {
	value: string;
}) {
	const group = React.useContext(RadioGroupContext);
	if (!group) throw new Error('RadioGroupItem must be used within RadioGroup');
	return (
		<input
			data-slot="radio-group-item"
			type="radio"
			name={group.name}
			value={value}
			checked={group.value === value}
			onChange={() => group.onValueChange(value)}
			disabled={disabled ?? group.disabled}
			className={cn(
				'size-4 shrink-0 accent-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

export { RadioGroup, RadioGroupItem };
