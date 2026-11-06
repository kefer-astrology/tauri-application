import { useId, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
import { useRightPanel } from '@/app/providers/right-panel';

type DetailSidePanelProps = {
	open: boolean;
	modal?: boolean;
	onInteractOutside?: ComponentProps<typeof SheetContent>['onInteractOutside'];
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	contentClassName?: string;
	bodyClassName?: string;
	onCloseAutoFocus?: ComponentProps<typeof SheetContent>['onCloseAutoFocus'];
	children: ReactNode;
};

/** A view in the app's right panel: title, optional description, scrolling body. Opened while
 *  another view is open, it shows on top with a Back button instead of stacking a second
 *  panel. Without a `RightPanelProvider` it opens its own sheet. */
export function DetailSidePanel(props: DetailSidePanelProps) {
	const panel = useRightPanel();
	return panel ? <SharedPanelView {...props} /> : <StandaloneSidePanel {...props} />;
}

function SharedPanelView({
	open,
	modal,
	onInteractOutside,
	onOpenChange,
	title,
	description,
	contentClassName,
	bodyClassName,
	onCloseAutoFocus,
	children
}: DetailSidePanelProps) {
	const panel = useRightPanel()!;
	const { show, hide } = panel;
	const id = useId();
	const onOpenChangeRef = useRef(onOpenChange);
	onOpenChangeRef.current = onOpenChange;

	useLayoutEffect(() => {
		if (!open) return;
		show({
			id,
			modal,
			onInteractOutside,
			title,
			description,
			contentClassName,
			bodyClassName,
			onCloseAutoFocus,
			onClose: () => onOpenChangeRef.current(false)
		});
	}, [
		open,
		id,
		modal,
		onInteractOutside,
		title,
		description,
		contentClassName,
		bodyClassName,
		onCloseAutoFocus,
		show
	]);

	useLayoutEffect(() => {
		if (!open) return;
		return () => hide(id);
	}, [open, id, hide]);

	const container = panel.containers.get(id);
	return open && container ? createPortal(children, container) : null;
}

function StandaloneSidePanel({
	open,
	modal,
	onInteractOutside,
	onOpenChange,
	title,
	description,
	contentClassName,
	bodyClassName,
	onCloseAutoFocus,
	children
}: DetailSidePanelProps) {
	const ft = useAppFormFieldTheme();

	return (
		<Sheet open={open} modal={modal} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				onInteractOutside={onInteractOutside}
				onCloseAutoFocus={onCloseAutoFocus}
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
