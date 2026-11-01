import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/app/components/ui/accordion';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ColorInput } from '@/app/components/ui/color-input';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';
import { cn } from '@/app/components/ui/utils';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';
import { useWorkspace } from '@/app/providers/workspace';
import { ASPECT_ROWS, DEFAULT_ASPECT_COLORS, type AspectRow } from '@/lib/astrology/aspects';
import { OBSERVABLE_OBJECTS, getObservableObjectLabel } from '@/lib/astrology/observableObjects';
import type { AspectLineStyleId, AspectLineTierStyleState } from '@/lib/tauri/chartPayload';
import type { AstrologicalTraditionId, ObjectTypeId } from '@/lib/tauri/types';
import {
	aspectDefaultsPatch,
	aspectRowsFromDefaults,
	EXTENDED_OBJECT_TYPE_OPTIONS,
	suggestedObjectOrb,
	toggleExtendedObjectTypes,
	type AspectRowState
} from '@/lib/settings/aspectSettings';
import { SettingSelect } from '../settings-controls';
import { useSettingsDraft } from '../settings-draft';

const ASTROLOGY_TRADITION_OPTIONS: { value: AstrologicalTraditionId; labelKey: string }[] = [
	{ value: 'hellenistic', labelKey: 'tradition_hellenistic' },
	{ value: 'medieval_traditional', labelKey: 'tradition_medieval_traditional' },
	{ value: 'modern_western', labelKey: 'tradition_modern_western' },
	{ value: 'harmonic', labelKey: 'tradition_harmonic' },
	{ value: 'cosmobiology', labelKey: 'tradition_cosmobiology' },
	{ value: 'uranian_hamburg', labelKey: 'tradition_uranian_hamburg' },
	{ value: 'jyotish_parashari', labelKey: 'tradition_jyotish_parashari' }
];

/** Numeric aspect-line tier fields: id, label key, minimum accepted value, step. */
const TIER_FIELDS: {
	id: Exclude<keyof AspectLineTierStyleState, 'outerLineStyle'>;
	labelKey: string;
	min: number;
	step: number;
}[] = [
	{ id: 'tightThresholdPct', labelKey: 'settings_aspect_line_tight_pct', min: 0, step: 0.1 },
	{ id: 'mediumThresholdPct', labelKey: 'settings_aspect_line_medium_pct', min: 0, step: 0.1 },
	{ id: 'looseThresholdPct', labelKey: 'settings_aspect_line_loose_pct', min: 0, step: 0.1 },
	{ id: 'widthTight', labelKey: 'settings_aspect_line_width_tight', min: 0.25, step: 0.25 },
	{ id: 'widthMedium', labelKey: 'settings_aspect_line_width_medium', min: 0.25, step: 0.25 },
	{ id: 'widthLoose', labelKey: 'settings_aspect_line_width_loose', min: 0.25, step: 0.25 },
	{ id: 'widthOuter', labelKey: 'settings_aspect_line_width_outer', min: 0.25, step: 0.25 }
];

const OUTER_LINE_STYLES: { value: AspectLineStyleId; label: string }[] = [
	{ value: 'solid', label: 'Solid' },
	{ value: 'dashed', label: 'Dashed' },
	{ value: 'dotted', label: 'Dotted' }
];

/** Small labelled orb input for one object. */
function ObjectOrbInput({
	label,
	value,
	onChange
}: {
	label: string;
	value: number;
	onChange: (orb: number) => void;
}) {
	const ft = useAppFormFieldTheme();
	return (
		<div className="flex items-center justify-between gap-2">
			<span className={cn('truncate text-xs', ft.muted)}>{label}</span>
			<Input
				type="number"
				className={cn(ft.inputCompact, 'h-8 w-16')}
				value={value}
				min={0}
				step={0.5}
				onChange={(event) => {
					const orb = Number(event.target.value);
					if (Number.isFinite(orb)) onChange(orb);
				}}
			/>
		</div>
	);
}

function CaptionedGrid({ caption, children }: { caption: string; children: React.ReactNode }) {
	const ft = useAppFormFieldTheme();
	return (
		<div className="space-y-1.5">
			<p className={cn('text-[0.65rem] tracking-wide uppercase', ft.muted)}>{caption}</p>
			<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">{children}</div>
		</div>
	);
}

/** One default aspect: enabled, color, orb, and per-object orbs for eligible objects. */
function AspectRowEditor({
	aspect,
	row,
	onRowChange,
	onOrbCommit,
	extendedObjectTypes,
	objectOrbs,
	onObjectOrbChange
}: {
	aspect: AspectRow;
	row: AspectRowState;
	/** `persist: false` while typing an orb; it is saved by `onOrbCommit` on blur. */
	onRowChange: (patch: Partial<AspectRowState>, persist?: boolean) => void;
	onOrbCommit: () => void;
	extendedObjectTypes: ObjectTypeId[];
	objectOrbs: Record<string, number>;
	onObjectOrbChange: (id: string, orb: number) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const planets = OBSERVABLE_OBJECTS.filter(
		(item) => item.objectType === 'planet' && item.status === 'available'
	);
	return (
		<AccordionItem
			value={aspect.id}
			className="rounded-xl border-0 bg-[color:var(--theme-soft-bg)]/45 px-4"
		>
			<div className="flex items-center gap-3 py-3">
				<Label className="flex flex-1 cursor-pointer items-center gap-3">
					<Checkbox
						checked={row.enabled}
						onCheckedChange={(checked) => onRowChange({ enabled: checked === true })}
					/>
					<span className={cn('text-sm', ft.title)}>{t(aspect.labelKey)}</span>
				</Label>
				<ColorInput
					value={row.color}
					onChange={(event) => onRowChange({ color: event.target.value })}
					aria-label={`${t(aspect.labelKey)} ${t('color_theme')}`}
				/>
				<AccordionTrigger className="w-auto flex-none gap-2 py-0 text-xs hover:no-underline">
					<span className={cn('tracking-wide uppercase tabular-nums', ft.muted)}>
						{row.orb}° {t('label_orb')}
					</span>
				</AccordionTrigger>
			</div>
			<AccordionContent className="pt-0 pb-4">
				<div className="space-y-3 rounded-lg bg-black/10 p-3 dark:bg-white/5">
					<div className="grid grid-cols-[1fr_auto] items-center gap-3">
						<Label className={cn('text-xs', ft.muted)} htmlFor={`${aspect.id}-orb`}>
							{t('label_orb')}
						</Label>
						<Input
							id={`${aspect.id}-orb`}
							type="number"
							className={cn(ft.inputCompact, 'h-9 w-20')}
							value={row.orb}
							min={0}
							max={30}
							step={0.5}
							onChange={(event) => {
								const orb = Number(event.target.value);
								onRowChange({ orb: Number.isFinite(orb) ? orb : row.orb }, false);
							}}
							onBlur={onOrbCommit}
						/>
					</div>
					{/* Planets are always eligible but each still gets its own orb, the same global
					    per-object mechanism as the opt-in categories below. */}
					<div className="border-t border-[color:var(--theme-panel-border)]/60 pt-3">
						<CaptionedGrid caption={t('settings_aspect_scope_planets')}>
							{planets.map((item) => (
								<ObjectOrbInput
									key={item.id}
									label={getObservableObjectLabel(item, t)}
									value={objectOrbs[item.id] ?? row.orb}
									onChange={(orb) => onObjectOrbChange(item.id, orb)}
								/>
							))}
						</CaptionedGrid>
					</div>
					{extendedObjectTypes.length > 0 && (
						<div className="space-y-3 border-t border-[color:var(--theme-panel-border)]/60 pt-3">
							{EXTENDED_OBJECT_TYPE_OPTIONS.filter((option) =>
								option.types.some((type) => extendedObjectTypes.includes(type))
							).map((option) => {
								const items = OBSERVABLE_OBJECTS.filter(
									(item) =>
										item.objectType !== null &&
										option.types.includes(item.objectType) &&
										item.status === 'available'
								);
								if (items.length === 0) return null;
								return (
									<CaptionedGrid key={option.labelKey} caption={t(option.labelKey)}>
										{items.map((item) => (
											<ObjectOrbInput
												key={item.id}
												label={getObservableObjectLabel(item, t)}
												value={objectOrbs[item.id] ?? suggestedObjectOrb()}
												onChange={(orb) => onObjectOrbChange(item.id, orb)}
											/>
										))}
									</CaptionedGrid>
								);
							})}
						</div>
					)}
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}

/** Radix aspect-line tiers: closeness thresholds, widths and the outer tier's line style.
 *  Numbers are saved on blur when valid. */
function AspectLineTiersEditor({
	tiers,
	onTiersChange,
	onCommit
}: {
	tiers: AspectLineTierStyleState;
	onTiersChange: (update: (tiers: AspectLineTierStyleState) => AspectLineTierStyleState) => void;
	onCommit: (patch: Partial<AspectLineTierStyleState>) => void;
}) {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { markChanged } = useSettingsDraft();
	return (
		<div className="space-y-3 rounded-xl bg-[color:var(--theme-soft-bg)]/45 px-4 py-4">
			<p className={ft.label}>{t('settings_radix_aspect_lines_title')}</p>
			<p className={cn('text-xs', ft.muted)}>{t('settings_radix_aspect_lines_hint')}</p>
			<div className="grid gap-3 sm:grid-cols-2">
				{TIER_FIELDS.map((field) => (
					<div key={field.id} className="space-y-1">
						<Label className="text-xs">{t(field.labelKey)}</Label>
						<Input
							type="number"
							className={cn(ft.inputCompact, 'h-9')}
							min={field.min}
							step={field.step}
							value={tiers[field.id]}
							onChange={(event) => {
								const value = Number(event.target.value);
								onTiersChange((previous) => ({
									...previous,
									[field.id]: Number.isFinite(value) ? value : previous[field.id]
								}));
								markChanged();
							}}
							onBlur={(event) => {
								const value = Number(event.target.value);
								if (!Number.isFinite(value) || value < field.min) return;
								onCommit({ [field.id]: value });
							}}
						/>
					</div>
				))}
				<div className="space-y-1">
					<Label className="text-xs">{t('settings_aspect_line_outer_style')}</Label>
					<SettingSelect
						value={tiers.outerLineStyle}
						options={OUTER_LINE_STYLES}
						triggerClassName="h-9 shadow-none"
						onValueChange={(outerLineStyle) => {
							onTiersChange((previous) => ({ ...previous, outerLineStyle }));
							markChanged();
							onCommit({ outerLineStyle });
						}}
					/>
				</div>
			</div>
		</div>
	);
}

/** Astrology tradition, aspect-eligible object categories, default aspects with orbs and
 *  colors, per-object orbs, and radix aspect-line tiers. Everything applies immediately. */
export function AspectSettingsSection() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const { workspaceDefaults, applyDefaultsPatch } = useWorkspace();
	const { markChanged } = useSettingsDraft();
	const [tradition, setTradition] = useState<AstrologicalTraditionId | ''>(
		workspaceDefaults.astrologyTradition ?? ''
	);
	const [extendedObjectTypes, setExtendedObjectTypes] = useState(
		workspaceDefaults.extendedObjectTypes
	);
	const [objectOrbs, setObjectOrbs] = useState(workspaceDefaults.objectOrbs);
	const [rows, setRows] = useState(() => aspectRowsFromDefaults(workspaceDefaults));
	const [tiers, setTiers] = useState<AspectLineTierStyleState>(() => ({
		...workspaceDefaults.aspectLineTierStyle
	}));

	useEffect(() => {
		setTradition(workspaceDefaults.astrologyTradition ?? '');
		setExtendedObjectTypes(workspaceDefaults.extendedObjectTypes);
		setObjectOrbs(workspaceDefaults.objectOrbs);
		setRows(aspectRowsFromDefaults(workspaceDefaults));
		setTiers({ ...workspaceDefaults.aspectLineTierStyle });
	}, [workspaceDefaults]);

	const persistRows = (next: Record<string, AspectRowState>) =>
		void applyDefaultsPatch(aspectDefaultsPatch(next));

	const changeObjectOrb = (id: string, orb: number) => {
		const next = { ...objectOrbs, [id]: orb };
		setObjectOrbs(next);
		markChanged();
		void applyDefaultsPatch({ objectOrbs: next });
	};

	const commitTiers = (patch: Partial<AspectLineTierStyleState>) =>
		setTiers((previous) => {
			const next = { ...previous, ...patch };
			void applyDefaultsPatch({ aspectLineTierStyle: next });
			return next;
		});

	return (
		<div className="space-y-4">
			<div className="rounded-xl bg-[color:var(--theme-soft-bg)]/45 px-4 py-4">
				<SettingSelect
					label={t('settings_astrology_tradition_label')}
					hint={t('settings_astrology_tradition_hint')}
					placeholder={t('settings_astrology_tradition_none')}
					value={tradition}
					options={ASTROLOGY_TRADITION_OPTIONS.map((option) => ({
						value: option.value,
						label: t(option.labelKey)
					}))}
					onValueChange={(next) => {
						setTradition(next);
						markChanged();
						void applyDefaultsPatch({ astrologyTradition: next });
					}}
				/>
			</div>
			<div className="space-y-2 rounded-xl bg-[color:var(--theme-soft-bg)]/45 px-4 py-4">
				<p className={ft.label}>{t('settings_aspect_scope_extended_categories')}</p>
				<p className={cn('text-xs', ft.muted)}>{t('settings_aspect_scope_extended_shared_hint')}</p>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{EXTENDED_OBJECT_TYPE_OPTIONS.map((option) => (
						<Label key={option.labelKey} className="flex cursor-pointer items-center gap-2 text-sm">
							<Checkbox
								checked={option.types.some((type) => extendedObjectTypes.includes(type))}
								onCheckedChange={(checked) => {
									const next = toggleExtendedObjectTypes(
										{ extendedObjectTypes, objectOrbs },
										option.types,
										checked === true
									);
									setExtendedObjectTypes(next.extendedObjectTypes);
									setObjectOrbs(next.objectOrbs);
									markChanged();
									void applyDefaultsPatch(next);
								}}
							/>
							{t(option.labelKey)}
						</Label>
					))}
				</div>
			</div>
			<div className="space-y-2">
				<p className={ft.label}>{t('default_aspects')}</p>
				<Accordion type="multiple" className="space-y-3">
					{ASPECT_ROWS.map((aspect) => {
						const row = rows[aspect.id] ?? {
							enabled: true,
							orb: aspect.defaultOrb,
							color: DEFAULT_ASPECT_COLORS[aspect.id]
						};
						return (
							<AspectRowEditor
								key={aspect.id}
								aspect={aspect}
								row={row}
								onRowChange={(patch, persist = true) => {
									const next = { ...rows, [aspect.id]: { ...row, ...patch } };
									setRows(next);
									markChanged();
									if (persist) persistRows(next);
								}}
								onOrbCommit={() => persistRows(rows)}
								extendedObjectTypes={extendedObjectTypes}
								objectOrbs={objectOrbs}
								onObjectOrbChange={changeObjectOrb}
							/>
						);
					})}
				</Accordion>
			</div>
			<Separator className="bg-[color:var(--theme-panel-border)]" />
			<AspectLineTiersEditor tiers={tiers} onTiersChange={setTiers} onCommit={commitTiers} />
		</div>
	);
}
