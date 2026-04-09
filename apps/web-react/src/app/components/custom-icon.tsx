import React from 'react';
import iconExport from '@/assets/cd050dea44ed41cb1f11f1ca88ec1a6b0ce8a522.png';
import iconImport from '@/assets/c4911b3334221657254a3ce22657e67133d89b8d.png';
import iconFolder from '@/assets/9dc57f08c877c46b1fd4c47f6d1c3a354573e804.png';
import iconPlus from '@/assets/f1a835e6611ddec4fdb45a1166794977e2f235bb.png';
import iconRadix from '@/assets/05d40af4dff8fb3f44ac73dd13c1f74ef04ae3fe.png';

export type IconType = 'export' | 'import' | 'folder' | 'plus' | 'radix';

interface CustomIconProps {
	type: IconType;
	className?: string;
	color?: string;
}

const iconMap = {
	export: iconExport,
	import: iconImport,
	folder: iconFolder,
	plus: iconPlus,
	radix: iconRadix
};

export function CustomIcon({ type, className = '', color }: CustomIconProps) {
	const iconSrc = iconMap[type];

	return (
		<div
			className={`inline-flex items-center justify-center ${className}`}
			style={{
				WebkitMaskImage: `url(${iconSrc})`,
				WebkitMaskSize: 'contain',
				WebkitMaskRepeat: 'no-repeat',
				WebkitMaskPosition: 'center',
				maskImage: `url(${iconSrc})`,
				maskSize: 'contain',
				maskRepeat: 'no-repeat',
				maskPosition: 'center',
				backgroundColor: color || 'currentColor'
			}}
		/>
	);
}
