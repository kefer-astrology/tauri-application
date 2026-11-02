import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

/** Small "Open chart" action next to an instant in the event lists. */
export function OpenChartButton({
	onClick,
	className
}: {
	onClick: () => void;
	className?: string;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	return (
		<Button
			type="button"
			variant="ghost"
			className={cn('h-6 px-2 text-xs', ft.bodyText, className)}
			onClick={onClick}
		>
			{t('transits_open_chart_action', { defaultValue: 'Open chart' })}
		</Button>
	);
}
