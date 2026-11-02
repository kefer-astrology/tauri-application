import type { ReactNode } from 'react';
import { cn } from '@/app/components/ui/utils';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle
} from '@/app/components/ui/sheet';
import { Separator } from '@/app/components/ui/separator';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { Surface } from '@/app/components/ui/container';

type DetailSidePanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	contentClassName?: string;
	bodyClassName?: string;
	children: ReactNode;
};

export function DetailSidePanel({
	open,
	onOpenChange,
	title,
	description,
	contentClassName,
	bodyClassName,
	children
}: DetailSidePanelProps) {
	const ft = useAppFormFieldTheme();

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className={cn('w-full gap-0 p-0 sm:max-w-md lg:w-[min(28rem,22vw)]', contentClassName)}
			>
				<div className="flex h-full min-h-0 flex-col">
					<SheetHeader className="shrink-0">
						<SheetTitle className={cn('text-lg font-semibold', ft.title)}>{title}</SheetTitle>
						{description ? (
							<SheetDescription className={cn('text-sm', ft.muted)}>{description}</SheetDescription>
						) : null}
					</SheetHeader>
					<Separator />
					<Surface
						variant="plain"
						padding="default"
						className={cn('min-h-0 flex-1', bodyClassName)}
					>
						{children}
					</Surface>
				</div>
			</SheetContent>
		</Sheet>
	);
}
