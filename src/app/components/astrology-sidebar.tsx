import React, { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
	Menu,
	Save,
	Grid3x3,
	Info,
	RefreshCw,
	RotateCcw,
	Users,
	Settings,
	Sunrise,
	Sun,
	Sunset,
	Moon,
	CirclePlus,
	FolderOpen,
	Upload
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './ui/utils';
import { KeferIcon, KeferLogoFull } from './kefer-logo';
import { HoroskopeIcon, TranzityIcon } from './astrology-icons';

export type Theme = 'sunrise' | 'noon' | 'twilight' | 'midnight';

interface SidebarProps {
	onThemeChange?: (theme: Theme) => void;
	currentTheme?: Theme;
	onMenuItemClick?: (itemId: string) => void;
	activeMenuItem?: string;
}

/** `internal_name` in translations.csv */
const menuItemDefs = [
	{ id: 'novy', labelKey: 'sidebar_new', icon: CirclePlus },
	{ id: 'otevrit', labelKey: 'sidebar_open', icon: FolderOpen },
	{ id: 'ulozit', labelKey: 'sidebar_save', icon: Save },
	{ id: 'export', labelKey: 'export', icon: Upload }
] as const;

const exportSectionDefs = [
	{ id: 'horoskop', labelKey: 'sidebar_horoscope', icon: HoroskopeIcon },
	{ id: 'aspektarium', labelKey: 'aspects_aspects', icon: Grid3x3 },
	{ id: 'informace', labelKey: 'sidebar_information', icon: Info },
	{ id: 'tranzity', labelKey: 'sidebar_transits', icon: TranzityIcon },
	{ id: 'dynamika', labelKey: 'sidebar_dynamics', icon: RefreshCw },
	{ id: 'revoluce', labelKey: 'revolution', icon: RotateCcw },
	{ id: 'synastrie', labelKey: 'sidebar_synastry', icon: Users },
	{ id: 'nastaveni', labelKey: 'settings', icon: Settings }
] as const;

const themeIconConfig = {
	sunrise: { icon: Sunrise },
	noon: { icon: Sun },
	twilight: { icon: Sunset },
	midnight: { icon: Moon }
} satisfies Record<Theme, { icon: typeof Sunrise }>;

export type SidebarThemeBlock = {
	bg: string;
	border: string;
	text: string;
	hover: string;
	active: string;
	activeIndicator: string;
	separator: string;
	logoGradient: string;
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
		activeIndicator: 'bg-sky-600',
		separator: 'bg-sky-200',
		logoGradient: 'from-sky-400 to-cyan-500',
		themeIconColor: '#1f2937'
	},
	noon: {
		bg: 'bg-white',
		border: 'border-gray-200',
		text: 'text-gray-700',
		hover: 'hover:bg-gray-100',
		active: 'bg-indigo-600 text-white',
		activeIndicator: 'bg-indigo-600',
		separator: 'bg-gray-200',
		logoGradient: 'from-indigo-500 to-purple-600',
		themeIconColor: '#374151'
	},
	twilight: {
		bg: 'bg-gradient-to-b from-indigo-100 to-indigo-200',
		border: 'border-indigo-300',
		text: 'text-indigo-900',
		hover: 'hover:bg-indigo-200',
		active: 'bg-indigo-600 text-white',
		activeIndicator: 'bg-indigo-600',
		separator: 'bg-indigo-300',
		logoGradient: 'from-indigo-600 to-purple-600',
		themeIconColor: '#4f46e5',
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
		activeIndicator: 'bg-indigo-500',
		separator: 'bg-slate-700/30',
		logoGradient: 'from-indigo-500 to-purple-600',
		themeIconColor: '#cbd5e1',
		customStyle: {
			background:
				'linear-gradient(to bottom, rgba(13, 27, 46, 0.98) 0%, rgba(10, 21, 40, 0.98) 50%, rgba(11, 23, 41, 0.98) 100%)',
			backdropFilter: 'blur(10px)',
			borderColor: 'rgba(51, 65, 85, 0.2)'
		}
	}
};

export function AstrologySidebar({
	onThemeChange,
	currentTheme = 'noon',
	onMenuItemClick,
	activeMenuItem
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
			<div className={cn('px-3', isExpanded ? 'mb-4' : 'mb-3')}>
				<div className={cn('flex items-center', isExpanded ? 'justify-start' : 'justify-center')}>
					{isExpanded ? (
						<KeferLogoFull iconSize={28} className={themeStyle.text} theme={currentTheme} />
					) : (
						<KeferIcon size={32} theme={currentTheme} />
					)}
				</div>
			</div>

			{/* Menu Toggle Button */}
			<div className="mb-1 px-3">
				<button
					onClick={toggleSidebar}
					className={cn(
						'flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200',
						themeStyle.text,
						themeStyle.hover,
						isExpanded ? 'justify-start' : 'justify-center'
					)}
				>
					<Menu className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
					{isExpanded && <span className="text-sm font-medium">{t('sidebar_menu')}</span>}
				</button>
			</div>

			{/* Main Menu Items */}
			<nav className="scrollbar-hide flex-1 space-y-0.5 overflow-y-auto px-3">
				{menuItemDefs.map((item) => {
					const Icon = item.icon;
					const isActive = currentActiveItem === item.id;

					return (
						<button
							key={item.id}
							onClick={() => {
								onMenuItemClick?.(item.id);
							}}
							className={cn(
								'flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200',
								isActive ? themeStyle.active : cn(themeStyle.text, themeStyle.hover),
								isExpanded ? 'justify-start' : 'justify-center'
							)}
						>
							<Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
							{isExpanded && <span className="text-sm font-medium">{t(item.labelKey)}</span>}
						</button>
					);
				})}

				{/* Separator */}
				<div className="py-1.5">
					<div className={cn('h-px', themeStyle.separator)} />
				</div>

				{/* Export Section */}
				{exportSectionDefs.map((item) => {
					const Icon = item.icon;
					const isActive = currentActiveItem === item.id;

					return (
						<button
							key={item.id}
							onClick={() => {
								onMenuItemClick?.(item.id);
							}}
							className={cn(
								'flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200',
								isActive ? themeStyle.active : cn(themeStyle.text, themeStyle.hover),
								isExpanded ? 'justify-start' : 'justify-center'
							)}
						>
							<Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
							{isExpanded && <span className="text-sm font-medium">{t(item.labelKey)}</span>}
						</button>
					);
				})}
			</nav>

			{/* Bottom Section — theme (Settings lives in main nav as last item) */}
			<div className="space-y-0.5 px-3 pb-3">
				{/* Separator */}
				<div className="pb-1.5">
					<div className={cn('h-px', themeStyle.separator)} />
				</div>

				{/* Theme Switcher */}
				{isExpanded ? (
					<div className="pt-1">
						<div
							className="bg-opacity-50 flex items-center justify-between gap-1 rounded-xl px-2 py-2"
							style={{
								backgroundColor:
									currentTheme === 'midnight' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(243, 244, 246, 0.5)'
							}}
						>
							{(Object.keys(themeIconConfig) as Theme[]).map((themeKey) => {
								const { icon: Icon } = themeIconConfig[themeKey];
								const isSelected = currentTheme === themeKey;

								return (
									<button
										key={themeKey}
										onClick={() => handleThemeClick(themeKey)}
										className={cn(
											'flex items-center justify-center rounded-lg p-1.5 transition-all duration-200',
											isSelected
												? 'bg-indigo-600 shadow-sm'
												: cn('hover:bg-opacity-50', themeStyle.hover)
										)}
										title={themeLabels[themeKey]}
									>
										<Icon
											className="h-4 w-4"
											strokeWidth={1.5}
											style={{ color: isSelected ? '#FFFFFF' : themeStyle.themeIconColor }}
										/>
									</button>
								);
							})}
						</div>
					</div>
				) : (
					<button
						onClick={cycleTheme}
						className={cn(
							'flex w-full items-center justify-center rounded-xl px-3 py-2 transition-all duration-200',
							themeStyle.hover
						)}
						title={t('sidebar_theme_cycle_hint', { theme: themeLabels[currentTheme] })}
					>
						{React.createElement(themeIconConfig[currentTheme].icon, {
							className: 'w-5 h-5',
							strokeWidth: 1.5,
							style: { color: themeStyle.themeIconColor }
						})}
					</button>
				)}
			</div>
		</aside>
	);
}
