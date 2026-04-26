import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
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
		bg: 'bg-gradient-to-b from-sky-50 to-cyan-50',
		border: 'border-sky-200',
		text: 'text-gray-900',
		hover: 'hover:bg-sky-100',
		active: 'bg-sky-400 text-white',
		separator: 'bg-sky-200',
		themeIconColor: '#1f2937'
	},
	noon: {
		bg: 'bg-white',
		border: 'border-gray-200',
		text: 'text-gray-700',
		hover: 'hover:bg-gray-100',
		active: 'bg-neutral-900 text-white',
		separator: 'bg-gray-200',
		themeIconColor: '#374151'
	},
	twilight: {
		bg: 'bg-gradient-to-b from-indigo-100 to-indigo-200',
		border: 'border-white/20',
		text: 'text-white',
		hover: 'hover:bg-white/10',
		active: 'bg-indigo-600 text-white',
		separator: 'bg-white/25',
		themeIconColor: '#ffffff',
		customStyle: {
			background:
				'linear-gradient(to bottom, rgba(30, 64, 175, 0.9) 0%, rgba(37, 99, 235, 0.9) 50%, rgba(29, 78, 216, 0.85) 100%)',
			backdropFilter: 'blur(10px)',
			borderColor: 'rgba(59, 130, 246, 0.3)'
		}
	},
	midnight: {
		bg: 'bg-gradient-to-b from-slate-900 to-slate-800',
		border: 'border-slate-700/30',
		text: 'text-slate-200',
		hover: 'hover:bg-slate-700/40',
		active: 'bg-indigo-600 text-white',
		separator: 'bg-slate-700/30',
		themeIconColor: '#cbd5e1',
		customStyle: {
			background:
				'linear-gradient(to bottom, rgba(13, 27, 46, 0.98) 0%, rgba(10, 21, 40, 0.98) 50%, rgba(11, 23, 41, 0.98) 100%)',
			backdropFilter: 'blur(10px)',
			borderColor: 'rgba(51, 65, 85, 0.2)'
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
				currentTheme === 'midnight' || currentTheme === 'twilight'
					? { paddingTop: '12px', ...themeStyle.customStyle }
					: { paddingTop: '12px' }
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
				<button
					onClick={toggleSidebar}
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
				</button>
			</div>

			{/* Main Menu Items */}
			<nav className="scrollbar-hide flex-1 space-y-0 overflow-y-auto px-3">
				{menuItemDefs.map((item) => {
					const isActive = currentActiveItem === item.id;

					return (
						<button
							key={item.id}
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
						</button>
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
						<button
							key={item.id}
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
						</button>
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
						<button
							key={item.id}
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
						</button>
					);
				})}

				{/* Theme Switcher */}
				{isExpanded ? (
					<div className="pt-1">
						<div
							className="bg-opacity-50 flex items-center justify-between gap-0.5 rounded-md px-1.5 py-1.5"
							style={{
								backgroundColor:
									currentTheme === 'midnight' || currentTheme === 'twilight'
										? 'rgba(51, 65, 85, 0.5)'
										: 'rgba(243, 244, 246, 0.5)'
							}}
						>
							{themeOrder.map((themeKey) => {
								const isSelected = currentTheme === themeKey;
								const themeIconId = `theme-${themeKey}` as AppShellIconId;

								return (
									<button
										key={themeKey}
										onClick={() => handleThemeClick(themeKey)}
										className={cn(
											'flex size-9 shrink-0 items-center justify-center rounded-sm p-0 transition-all duration-200',
											isSelected
												? currentTheme === 'twilight' || currentTheme === 'midnight'
													? 'bg-indigo-600 shadow-sm'
													: currentTheme === 'sunrise'
														? 'bg-sky-500 shadow-sm'
														: 'bg-neutral-900 shadow-sm'
												: cn('hover:bg-opacity-50', themeStyle.hover)
										)}
										title={themeLabels[themeKey]}
										>
											<span style={{ color: isSelected ? '#FFFFFF' : themeStyle.themeIconColor }}>
												{renderThemeIcon(themeIconId, themeLabels[themeKey])}
											</span>
										</button>
								);
							})}
						</div>
					</div>
				) : (
					<button
						onClick={cycleTheme}
						className={cn(
							'flex w-full items-center justify-center',
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
						</button>
				)}
			</div>
		</aside>
	);
}
