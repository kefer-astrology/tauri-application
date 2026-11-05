import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useWorkspaceCharts } from '@/app/providers/workspace-charts';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import { TimeNavigator } from '@/app/views/domain/time-navigator';
import { astrolabeMaxAmount, type AstrolabeUnit } from '@/lib/astrology/chartView';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useHoroskop } from '../horoskop-context';
import { useWidgetChrome } from '../../workspace/use-widget-chrome';

/** Steps the active chart's moment back and forward (the astrolabe). */
export function AstrolabeWidget({ instance }: { instance: WidgetInstance }) {
	const { t } = useTranslation();
	const { shiftSelectedChartTime } = useWorkspaceCharts();
	const { chart, labels } = useHoroskop();
	const chrome = useWidgetChrome(instance, t('astrolabe'));
	const [unit, setUnit] = useState<AstrolabeUnit>('day');
	const [amount, setAmount] = useState(1);
	const [stepping, setStepping] = useState(false);

	const step = async (direction: -1 | 1) => {
		if (!chart || stepping) return;
		setStepping(true);
		try {
			await shiftSelectedChartTime({ unit, amount: amount * direction });
		} catch (error) {
			console.error('Astrolabe time step failed:', error);
			toast.error(t('toast_save_failed'), {
				description: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setStepping(false);
		}
	};

	return (
		<WidgetFrame {...chrome} title={t('astrolabe')} dataTour="radix-astrolabe">
			<TimeNavigator
				amount={amount}
				unit={unit}
				onAmountChange={setAmount}
				onUnitChange={(next) => {
					setUnit(next);
					setAmount((current) => Math.min(current, astrolabeMaxAmount(next)));
				}}
				onStep={(direction) => void step(direction)}
				disabled={stepping || !chart}
				readouts={{ date: labels.date, time: labels.time, location: labels.location }}
			/>
		</WidgetFrame>
	);
}
