import { SharedSvgIcon } from './shared-svg-icon';
import {
	getAppShellIconMaskScale,
	getAppShellIconSrc,
	getAppShellLogoFullWidth,
	getAppShellLogoSrc,
	APP_SHELL_MARK_MASK_SCALE,
	type AppShellIconId,
	type AppShellIconSetId
} from '@/lib/app-shell';

export function AppShellIcon({
	iconId,
	iconSet,
	className,
	size,
	title
}: {
	iconId: AppShellIconId;
	iconSet: AppShellIconSetId;
	className?: string;
	/** Omit to size with Tailwind on `className` (sidebar uses `size-7`). */
	size?: number;
	title?: string;
}) {
	return (
		<SharedSvgIcon
			src={getAppShellIconSrc(iconSet, iconId)}
			title={title}
			className={className}
			size={size}
			maskScale={getAppShellIconMaskScale(iconSet, iconId)}
		/>
	);
}

export function AppShellLogoMark({
	iconSet,
	className,
	size
}: {
	iconSet: AppShellIconSetId;
	className?: string;
	size: number;
}) {
	return (
		<SharedSvgIcon
			src={getAppShellLogoSrc(iconSet, 'mark')}
			className={className}
			size={size}
			maskScale={APP_SHELL_MARK_MASK_SCALE}
		/>
	);
}

export function AppShellLogoFull({
	iconSet,
	className,
	iconSize
}: {
	iconSet: AppShellIconSetId;
	className?: string;
	iconSize: number;
}) {
	return (
		<div className={className}>
			<SharedSvgIcon
				src={getAppShellLogoSrc(iconSet, 'full')}
				className="block"
				width={getAppShellLogoFullWidth(iconSet, iconSize)}
				height={iconSize}
				maskScale={0.98}
			/>
		</div>
	);
}
