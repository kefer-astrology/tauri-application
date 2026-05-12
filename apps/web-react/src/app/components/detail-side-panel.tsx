import type { ReactNode } from 'react';
import { cn } from './ui/utils';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle
} from './ui/sheet';
import { Separator } from './ui/separator';
import { useAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

type DetailSidePanelProps = {
	theme: Theme;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children: ReactNode;
};

export function DetailSidePanel({
	theme,
	open,
	onOpenChange,
	title,
	description,
	children
}: DetailSidePanelProps) {
	const ft = useAppFormFieldTheme(theme);
	const surfaceClassName =
		theme === 'twilight' || theme === 'midnight'
			? 'backdrop-blur-xl'
			: 'backdrop-blur-sm';

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className={cn(
					'w-full gap-0 p-0 sm:max-w-md lg:w-[min(28rem,22vw)]',
					'border-[color:var(--theme-panel-border)] bg-[color:var(--theme-panel-bg)] text-[color:var(--theme-content-primary)]',
					surfaceClassName
				)}
			>
				<div className="flex h-full min-h-0 flex-col">
					<SheetHeader className="shrink-0 px-5 py-4">
						<SheetTitle className={cn('text-lg font-semibold', ft.title)}>{title}</SheetTitle>
						{description ? (
							<SheetDescription className={cn('text-sm', ft.muted)}>
								{description}
							</SheetDescription>
						) : null}
					</SheetHeader>
					<Separator className="bg-[color:var(--theme-panel-border)]" />
					<div className="min-h-0 flex-1 px-5 py-4">{children}</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
