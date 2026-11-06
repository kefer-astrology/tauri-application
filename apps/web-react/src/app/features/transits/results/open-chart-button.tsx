import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';

/** Small "Open chart" action next to an instant in the event lists. */
export function OpenChartButton({
	onClick,
	className
}: {
	onClick: () => void;
	className?: string;
}) {
	const { t } = useTranslation();
	return (
		<Button
			type="button"
			variant="toolbar"
			size="toolbar"
			className={cn('h-6 px-2', className)}
			onClick={onClick}
		>
			{t('transits_open_chart_action', { defaultValue: 'Open chart' })}
		</Button>
	);
}
