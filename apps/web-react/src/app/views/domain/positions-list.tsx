import { useTranslation } from 'react-i18next';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { AstrologyGlyph } from '@/ui/astrology-glyph';
import { objectIcon, objectLabel } from '@/lib/astrology/objectLabels';
import { signPosition } from '@/lib/astrology/zodiac';
import { ObjectGlyph } from './object-glyph';

export interface BodyPosition {
	id: string;
	longitude: number;
	retrograde: boolean;
}

/**
 * Computed positions of a chart, one row per body: glyph, degrees, sign glyph, minutes, seconds
 * and an `R` marker for retrograde motion. Rows are clickable; `selectedId` is highlighted.
 */
export function PositionsList({
	positions,
	selectedId,
	onSelect,
	emptyText
}: {
	positions: readonly BodyPosition[];
	selectedId?: string | null;
	onSelect?: (id: string) => void;
	emptyText: string;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	if (positions.length === 0) {
		return <div className={cn('py-6 text-sm', ft.muted)}>{emptyText}</div>;
	}
	return (
		<div className="space-y-1.5">
			{positions.map(({ id, longitude, retrograde }) => {
				const label = objectLabel(id, t);
				const position = signPosition(longitude);
				return (
					<div
						key={id}
						className={cn(
							'flex items-center gap-0.5 rounded-md px-1 py-0.5 transition-colors',
							'font-mono text-sm leading-none tabular-nums',
							ft.title,
							onSelect && 'cursor-pointer',
							selectedId === id
								? 'bg-[color:var(--theme-selected-bg)]'
								: 'hover:bg-[color:var(--token-hover-subtle)]'
						)}
						title={label}
						onClick={onSelect ? () => onSelect(id) : undefined}
					>
						<span
							className={cn(
								'inline-flex h-[1.125rem] w-8 shrink-0 items-center justify-center',
								objectIcon(id).length > 2 && 'text-[10px] font-semibold'
							)}
						>
							<ObjectGlyph id={id} size={18} title={label} className="leading-none" />
						</span>
						<span className="w-12 text-right">{position.degrees}°</span>
						<span className="inline-flex h-[1.125rem] w-8 shrink-0 items-center justify-center">
							<AstrologyGlyph
								glyphId={position.signZodiacId}
								domain="zodiac"
								fallback={position.signGlyphFallback}
								size={18}
								title={position.signZodiacId}
								className="leading-none"
							/>
						</span>
						<span className="w-10 text-right">{position.minutes}'</span>
						<span className="w-10 text-right">{position.seconds}"</span>
						<span className="w-6 text-center text-[10px] font-semibold text-[color:var(--theme-accent)] uppercase">
							{retrograde ? 'R' : ''}
						</span>
					</div>
				);
			})}
		</div>
	);
}
