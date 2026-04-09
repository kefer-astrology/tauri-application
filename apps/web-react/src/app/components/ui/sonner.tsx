import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Desktop shell: `theme` can be passed from `App` (astrology theme); otherwise follows `html.dark`. */
const Toaster = ({ theme: themeProp, ...props }: ToasterProps) => {
	const fromDom =
		typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
	const theme = themeProp ?? (fromDom ? 'dark' : 'light');
	return (
		<Sonner
			theme={theme}
			className="toaster group"
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)'
				} as CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
