import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { AppShellIcon, AppShellLogoFull, AppShellLogoMark } from '@/ui/app-shell-icon';
import type { AppShellIconId, AppShellIconSetId } from '@/lib/app-shell';

export type Theme = 'sunrise' | 'noon' | 'twilight' | 'midnight';

interface SidebarProps {
	onThemeChange?: (theme: Theme) => void;
	currentTheme?: Theme;
	onMenuItemClick?: (itemId: string) => void;
	activeMenuItem?: string;
	appShellIconSet?: AppShellIconSetId;
}

/** `internal_name` in translations.csv */
const menuItemDefs = [
	{ id: 'novy', labelKey: 'sidebar_new', iconId: 'new' as const },
	{ id: 'otevrit', labelKey: 'sidebar_open', iconId: 'open' as const },
	{ id: 'ulozit', labelKey: 'sidebar_save', iconId: 'save' as const },
	{ id: 'export', labelKey: 'export', iconId: 'export' as const }
] as const;

/** Horoskop → Synastrie (below first separator, after Export block). */
const appSectionDefs = [
	{ id: 'horoskop', labelKey: 'sidebar_horoscope', iconId: 'horoscope' as const },
	{ id: 'aspektarium', labelKey: 'aspects_aspects', iconId: 'aspects' as const },
	{ id: 'informace', labelKey: 'sidebar_information', iconId: 'information' as const },
	{ id: 'tranzity', labelKey: 'sidebar_transits', iconId: 'transits' as const },
	{ id: 'dynamika', labelKey: 'sidebar_dynamics', iconId: 'dynamics' as const },
	{ id: 'revoluce', labelKey: 'revolution', iconId: 'revolution' as const },
	{ id: 'synastrie', labelKey: 'sidebar_synastry', iconId: 'synastry' as const }
] as const;

/** Second separator (Synastrie / Nastavení), same rule as Export / Horoskop. */
const settingsNavDefs = [
	{ id: 'nastaveni', labelKey: 'settings', iconId: 'settings' as const }
] as const;

const themeOrder: Theme[] = ['sunrise', 'noon', 'twilight', 'midnight'];

export type SidebarThemeBlock = {
	bg: string;
	border: string;
	text: string;
	hover: string;
	active: string;
	separator: string;
	themeIconColor: string;
	customStyle?: CSSProperties;
};

/** Shared by main sidebar and secondary (transits / settings) rail — four app themes only. */
export const sidebarThemeStyles: Record<Theme, SidebarThemeBlock> = {
	sunrise: {
		bg: '',
		border: 'border-[color:var(--theme-sidebar-border)]',
		text: 'text-[color:var(--theme-nav-text-secondary)]',
		hover: 'hover:bg-[color:var(--token-hover-strong)] hover:text-[color:var(--theme-nav-text-primary)]',
		active: 'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-nav-text-primary)]',
		separator: 'bg-[color:var(--theme-separator)]',
		themeIconColor: 'var(--theme-nav-text-primary)',
		customStyle: {
			background: 'linear-gradient(to bottom, var(--theme-main-sidebar-start) 0%, var(--theme-main-sidebar-end) 100%)',
			borderColor: 'var(--theme-sidebar-border)'
		}
	},
	noon: {
		bg: '',
		border: 'border-[color:var(--theme-sidebar-border)]',
		text: 'text-[color:var(--theme-nav-text-secondary)]',
		hover: 'hover:bg-[color:var(--token-hover-strong)] hover:text-[color:var(--theme-nav-text-primary)]',
		active: 'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-nav-text-primary)]',
		separator: 'bg-[color:var(--theme-separator)]',
		themeIconColor: 'var(--theme-nav-text-primary)',
		customStyle: {
			background: 'linear-gradient(to bottom, var(--theme-main-sidebar-start) 0%, var(--theme-main-sidebar-end) 100%)',
			borderColor: 'var(--theme-sidebar-border)'
		}
	},
	twilight: {
		bg: '',
		border: 'border-[color:var(--theme-sidebar-border)]',
		text: 'text-[color:var(--theme-nav-text-secondary)]',
		hover: 'hover:bg-[color:var(--token-hover-strong)] hover:text-[color:var(--theme-nav-text-primary)]',
		active: 'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-nav-text-primary)]',
		separator: 'bg-[color:var(--theme-separator)]',
		themeIconColor: 'var(--theme-nav-text-primary)',
		customStyle: {
			background: 'linear-gradient(to bottom, var(--theme-main-sidebar-start) 0%, var(--theme-main-sidebar-end) 100%)',
			borderColor: 'var(--theme-sidebar-border)'
		}
	},
	midnight: {
		bg: '',
		border: 'border-[color:var(--theme-sidebar-border)]',
		text: 'text-[color:var(--theme-nav-text-secondary)]',
		hover: 'hover:bg-[color:var(--token-hover-strong)] hover:text-[color:var(--theme-nav-text-primary)]',
		active: 'bg-[color:var(--theme-selected-bg)] text-[color:var(--theme-nav-text-primary)]',
		separator: 'bg-[color:var(--theme-separator)]',
		themeIconColor: 'var(--theme-nav-text-primary)',
		customStyle: {
			background: 'linear-gradient(to bottom, var(--theme-main-sidebar-start) 0%, var(--theme-main-sidebar-end) 100%)',
			borderColor: 'var(--theme-sidebar-border)'
		}
	}
};

/**
 * Hit area + type scale for sidebar menu rows. Shared with {@link SecondaryNavPanel}
 * (Tranzity / Nastavení) so sub-rails match the primary rail.
 */
export const sidebarNavMenuRowClassName =
	'h-11 rounded-md px-2.5 text-sm font-medium transition-all duration-200';

/**
 * Main left-rail nav icons (`AppShellIcon` `size`, px). Default set gets a slightly larger box + higher mask
 * in `app-shell.ts`; modern a smaller box + lower mask so the two meet visually.
 */
export const SIDEBAR_APP_SHELL_NAV_ICON_PX = {
	default: 34,
	modern: 30
} as const;

/** Theme strip + collapsed theme cycle (fits `size-9` ~36px hit targets). */
const SIDEBAR_THEME_APP_SHELL_ICON_PX = 26;

/** Stale HMR / old bundles referenced these names — keep as no-op strings so refresh is not required for the symbol table. */
export const sidebarAppShellIconClassModern = 'shrink-0';
export const sidebarAppShellIconClassDefault = 'shrink-0';

export function AstrologySidebar({
	onThemeChange,
	currentTheme = 'noon',
	onMenuItemClick,
	activeMenuItem,
	appShellIconSet = 'default'
}: SidebarProps) {
	const { t } = useTranslation();
	const [isExpanded, setIsExpanded] = useState(true);

	const themeLabels = useMemo(
		() => ({
			sunrise: t('sidebar_theme_sunrise'),
			noon: t('sidebar_theme_noon'),
			twilight: t('sidebar_theme_twilight'),
			midnight: t('sidebar_theme_midnight')
		}),
		[t]
	);

	// Use activeMenuItem from props or default to 'horoskop'
	const currentActiveItem = activeMenuItem || 'horoskop';

	const toggleSidebar = () => setIsExpanded(!isExpanded);

	const handleThemeClick = (theme: Theme) => {
		onThemeChange?.(theme);
	};

	const cycleTheme = () => {
		const themes: Theme[] = ['sunrise', 'noon', 'twilight', 'midnight'];
		const currentIndex = themes.indexOf(currentTheme);
		const nextTheme = themes[(currentIndex + 1) % themes.length];
		handleThemeClick(nextTheme);
	};

	const themeStyle = sidebarThemeStyles[currentTheme];
	const sidebarMainNavIconPx =
		appShellIconSet === 'default'
			? SIDEBAR_APP_SHELL_NAV_ICON_PX.default
			: SIDEBAR_APP_SHELL_NAV_ICON_PX.modern;

	const renderSharedIcon = (
		iconId: AppShellIconId,
		label: string,
		className = 'shrink-0',
		pixelSize: number = sidebarMainNavIconPx
	) => (
		<AppShellIcon
			iconId={iconId}
			iconSet={appShellIconSet}
			title={label}
			className={className}
			size={pixelSize}
		/>
	);

	const renderThemeIcon = (iconId: AppShellIconId, label: string) =>
		renderSharedIcon(iconId, label, 'shrink-0', SIDEBAR_THEME_APP_SHELL_ICON_PX);

	return (
		<aside
			className={cn(
				'flex h-screen flex-col border-r transition-all duration-300 ease-in-out',
				themeStyle.bg,
				themeStyle.border,
				isExpanded ? 'w-[220px]' : 'w-16'
			)}
			style={
				{ paddingTop: '12px', ...themeStyle.customStyle }
			}
		>
			{/* Logo Area */}
			<div className="mb-2.5 px-3">
				<div
					className={cn(
						'flex h-11 items-center',
						isExpanded ? 'justify-start px-2.5' : 'justify-center'
					)}
				>
						{isExpanded ? (
							<div className={cn('flex items-center gap-2.5', themeStyle.text)}>
								<AppShellLogoFull
									iconSet={appShellIconSet}
									className={themeStyle.text}
									iconSize={32}
								/>
							</div>
						) : (
							<AppShellLogoMark
								iconSet={appShellIconSet}
								className={themeStyle.text}
								size={32}
							/>
						)}
				</div>
			</div>

			{/* Menu Toggle Button */}
			<div className="mb-px px-3">
				<Button
					onClick={toggleSidebar}
					variant="ghost"
					className={cn(
						'flex w-full items-center gap-2',
						sidebarNavMenuRowClassName,
						themeStyle.text,
						themeStyle.hover,
						isExpanded ? 'justify-start' : 'mx-auto h-11 w-11 justify-center px-0 py-0'
					)}
				>
					{renderSharedIcon('menu', t('sidebar_menu'))}
					{isExpanded && <span>{t('sidebar_menu')}</span>}
				</Button>
			</div>

			{/* Main Menu Items */}
			<nav className="scrollbar-hide flex-1 space-y-0 overflow-y-auto px-3">
				{menuItemDefs.map((item) => {
					const isActive = currentActiveItem === item.id;

					return (
						<Button
							key={item.id}
							variant="ghost"
							onClick={() => {
								onMenuItemClick?.(item.id);
							}}
							className={cn(
								'flex w-full items-center gap-2',
								sidebarNavMenuRowClassName,
								isActive ? themeStyle.active : cn(themeStyle.text, themeStyle.hover),
								isExpanded ? 'justify-start' : 'mx-auto h-11 w-11 justify-center px-0 py-0'
							)}
						>
							{renderSharedIcon(item.iconId, t(item.labelKey))}
							{isExpanded && <span>{t(item.labelKey)}</span>}
						</Button>
					);
				})}

				{/* Separator */}
				<div className="py-0.5">
					<div className={cn('h-px', themeStyle.separator)} />
				</div>

				{/* App sections (Horoskop … Synastrie) */}
				{appSectionDefs.map((item) => {
					const isActive = currentActiveItem === item.id;

					return (
						<Button
							key={item.id}
							variant="ghost"
							onClick={() => {
								onMenuItemClick?.(item.id);
							}}
							className={cn(
								'flex w-full items-center gap-2',
								sidebarNavMenuRowClassName,
								isActive ? themeStyle.active : cn(themeStyle.text, themeStyle.hover),
								isExpanded ? 'justify-start' : 'mx-auto h-11 w-11 justify-center px-0 py-0'
							)}
						>
							{renderSharedIcon(item.iconId, t(item.labelKey))}
							{isExpanded && <span>{t(item.labelKey)}</span>}
						</Button>
					);
				})}
			</nav>

			{/* Bottom: Synastrie | Nastavení separator + Nastavení + theme switcher */}
			<div className="shrink-0 space-y-0 px-3 pb-3">
				{/* Separator — same as between Export / Horoskop */}
				<div className="py-0.5">
					<div className={cn('h-px', themeStyle.separator)} />
				</div>

				{settingsNavDefs.map((item) => {
					const isActive = currentActiveItem === item.id;

					return (
						<Button
							key={item.id}
							variant="ghost"
							onClick={() => {
								onMenuItemClick?.(item.id);
							}}
							className={cn(
								'flex w-full items-center gap-2',
								sidebarNavMenuRowClassName,
								isActive ? themeStyle.active : cn(themeStyle.text, themeStyle.hover),
								isExpanded ? 'justify-start' : 'mx-auto h-11 w-11 justify-center px-0 py-0'
							)}
						>
							{renderSharedIcon(item.iconId, t(item.labelKey))}
							{isExpanded && <span>{t(item.labelKey)}</span>}
						</Button>
					);
				})}

				{/* Theme Switcher */}
				{isExpanded ? (
					<div className="pt-1">
						<div
							className="bg-opacity-50 flex items-center justify-between gap-0.5 rounded-md px-1.5 py-1.5"
							style={{
								backgroundColor:
									'var(--theme-soft-bg)'
							}}
						>
							{themeOrder.map((themeKey) => {
								const isSelected = currentTheme === themeKey;
								const themeIconId = `theme-${themeKey}` as AppShellIconId;

								return (
									<Button
										key={themeKey}
										variant="ghost"
										size="icon"
										onClick={() => handleThemeClick(themeKey)}
										className={cn(
											'size-9 shrink-0 rounded-sm p-0 transition-all duration-200',
											isSelected
												? 'bg-[color:var(--theme-accent)] shadow-sm'
												: cn('hover:bg-opacity-50', themeStyle.hover)
										)}
										title={themeLabels[themeKey]}
										>
											<span
												style={{
													color: isSelected ? 'var(--theme-nav-text-primary)' : themeStyle.themeIconColor
												}}
											>
												{renderThemeIcon(themeIconId, themeLabels[themeKey])}
											</span>
										</Button>
								);
							})}
						</div>
					</div>
				) : (
					<Button
						onClick={cycleTheme}
						variant="ghost"
						size="icon"
						className={cn(
							'w-full',
							sidebarNavMenuRowClassName,
							themeStyle.hover,
							'mx-auto h-11 w-11 px-0 py-0'
						)}
						title={t('sidebar_theme_cycle_hint', { theme: themeLabels[currentTheme] })}
						>
							<span style={{ color: themeStyle.themeIconColor }}>
								{renderThemeIcon(
									`theme-${currentTheme}` as AppShellIconId,
									themeLabels[currentTheme]
								)}
							</span>
						</Button>
				)}
			</div>
		</aside>
	);
}
