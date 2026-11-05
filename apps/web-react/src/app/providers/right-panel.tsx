import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode
} from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { surfaceVariants } from '@/app/components/ui/container';
import { Separator } from '@/app/components/ui/separator';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle
} from '@/app/components/ui/sheet';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

/** One view shown in the right panel; registered by `DetailSidePanel` while it is open. */
export interface RightPanelEntry {
	id: string;
	title: string;
	description?: string;
	contentClassName?: string;
	bodyClassName?: string;
	onCloseAutoFocus?: ComponentProps<typeof SheetContent>['onCloseAutoFocus'];
	/** Asks the owner to close this view. */
	onClose: () => void;
}

interface RightPanelContextValue {
	/** Show or refresh a view; a new view goes on top of the open ones. */
	show: (entry: RightPanelEntry) => void;
	hide: (id: string) => void;
	/** Element the view's content renders into, once the panel has mounted it. */
	containers: ReadonlyMap<string, HTMLElement>;
}

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

/** The shared panel, if the app provides one (tests and isolated renders may not). */
export function useRightPanel(): RightPanelContextValue | null {
	return useContext(RightPanelContext);
}

/**
 * The one right-hand panel of the app. Views opened while another is open show on top of it
 * with a Back button; the views underneath stay mounted, so their unsaved input survives.
 * Escape goes back one view; the close button or a click outside closes them all.
 */
export function RightPanelProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const [entries, setEntries] = useState<RightPanelEntry[]>([]);
	const [containers, setContainers] = useState<ReadonlyMap<string, HTMLElement>>(() => new Map());

	const show = useCallback((entry: RightPanelEntry) => {
		setEntries((prev) =>
			prev.some((e) => e.id === entry.id)
				? prev.map((e) => (e.id === entry.id ? entry : e))
				: [...prev, entry]
		);
	}, []);

	const hide = useCallback((id: string) => {
		setEntries((prev) => prev.filter((e) => e.id !== id));
	}, []);

	const attach = useCallback((id: string, element: HTMLElement | null) => {
		setContainers((prev) => {
			if ((prev.get(id) ?? null) === element) return prev;
			const next = new Map(prev);
			if (element) next.set(id, element);
			else next.delete(id);
			return next;
		});
	}, []);

	// One stable ref callback per view, so re-renders do not detach and reattach containers.
	const refCallbacks = useRef(new Map<string, (element: HTMLElement | null) => void>());
	const containerRef = (id: string) => {
		let callback = refCallbacks.current.get(id);
		if (!callback) {
			callback = (element) => {
				attach(id, element);
				if (!element) refCallbacks.current.delete(id);
			};
			refCallbacks.current.set(id, callback);
		}
		return callback;
	};

	const value = useMemo(() => ({ show, hide, containers }), [show, hide, containers]);
	const top = entries[entries.length - 1];
	// A view without its own width keeps the width of the view it opened from.
	const contentClassName = [...entries].reverse().find((e) => e.contentClassName)?.contentClassName;
	const closeAll = () => [...entries].reverse().forEach((entry) => entry.onClose());

	return (
		<RightPanelContext.Provider value={value}>
			{children}
			<Sheet
				open={entries.length > 0}
				onOpenChange={(open) => {
					if (!open) closeAll();
				}}
			>
				<SheetContent
					side="right"
					onCloseAutoFocus={top?.onCloseAutoFocus}
					onEscapeKeyDown={(event) => {
						if (entries.length > 1) {
							event.preventDefault();
							top?.onClose();
						}
					}}
					className={cn('w-full gap-0 p-0 sm:max-w-md lg:w-[min(28rem,22vw)]', contentClassName)}
				>
					<div className="flex h-full min-h-0 flex-col">
						<SheetHeader className="shrink-0">
							<div className="flex items-center gap-2 pr-8">
								{entries.length > 1 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-8 shrink-0"
										onClick={() => top?.onClose()}
										aria-label={t('panel_back', { defaultValue: 'Back' })}
									>
										<ArrowLeft />
									</Button>
								)}
								<SheetTitle className={cn('min-w-0 truncate text-lg font-semibold', ft.title)}>
									{top?.title}
								</SheetTitle>
							</div>
							{top?.description ? (
								<SheetDescription className={cn('text-sm', ft.muted)}>
									{top.description}
								</SheetDescription>
							) : null}
						</SheetHeader>
						<Separator />
						{entries.map((entry) => (
							<div
								key={entry.id}
								ref={containerRef(entry.id)}
								data-slot="surface"
								hidden={entry !== top}
								className={cn(
									surfaceVariants({ variant: 'plain', padding: 'default' }),
									'min-h-0 flex-1',
									entry.bodyClassName
								)}
							/>
						))}
					</div>
				</SheetContent>
			</Sheet>
		</RightPanelContext.Provider>
	);
}
