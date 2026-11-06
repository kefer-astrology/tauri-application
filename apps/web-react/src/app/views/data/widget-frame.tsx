import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { OverflowMenu, type OverflowMenuItem } from '@/app/components/ui/overflow-menu';
import { Heading } from '@/app/components/ui/typography';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

/**
 * The frame every widget is drawn in: a header with a collapse button and title, optional
 * header actions (a pencil only where it edits content), and the body. The collapse control is
 * a real button (keyboard and screen readers); the body stays mounted while collapsed. The `⋯`
 * menu holds the widget's actions (remove from the workspace, …).
 */
export function WidgetFrame({
	title,
	actions,
	menu,
	highlighted = false,
	instanceId,
	defaultCollapsed = false,
	fill = false,
	bodyClassName,
	className,
	dataTour,
	children
}: {
	title: ReactNode;
	actions?: ReactNode;
	/** The `⋯` menu, shown after the actions. */
	menu?: { label: string; items: readonly OverflowMenuItem[] };
	/** Briefly emphasized (just added, or found from the catalog). */
	highlighted?: boolean;
	/** Marks the frame so the catalog can find it on the workspace. */
	instanceId?: string;
	defaultCollapsed?: boolean;
	/** Stretch to the region's height while expanded (e.g. a scrolling table). */
	fill?: boolean;
	bodyClassName?: string;
	className?: string;
	/** Guided-tour anchor. */
	dataTour?: string;
	children: ReactNode;
}) {
	const ft = useAppFormFieldTheme();
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const bodyId = useId();

	return (
		<Card
			variant="default"
			spacing="flush"
			clip
			data-tour={dataTour}
			data-collapsed={collapsed ? 'true' : undefined}
			data-widget-instance={instanceId}
			className={cn(
				'transition-all duration-300',
				fill && !collapsed && 'h-full',
				highlighted && 'ring-2 ring-[color:var(--theme-accent)]',
				className
			)}
		>
			<div className="flex shrink-0 items-center justify-between gap-1 px-4 py-3">
				<Heading variant="sectionTitle" level={3} className={cn('min-w-0 flex-1', ft.title)}>
					<Button
						variant="ghost"
						size="inline"
						className="w-full justify-start gap-2 text-left whitespace-normal"
						aria-expanded={!collapsed}
						aria-controls={bodyId}
						onClick={() => setCollapsed((value) => !value)}
					>
						{collapsed ? (
							<ChevronRight className={ft.muted} aria-hidden="true" />
						) : (
							<ChevronDown className={ft.muted} aria-hidden="true" />
						)}
						{title}
					</Button>
				</Heading>
				{actions}
				{menu && menu.items.length > 0 ? (
					<OverflowMenu label={menu.label} items={menu.items} />
				) : null}
			</div>
			<div id={bodyId} hidden={collapsed} className={cn('px-4 pb-4', bodyClassName)}>
				{children}
			</div>
		</Card>
	);
}
