import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { cn } from './ui/utils';
import { getAppFormFieldTheme } from './form-field-theme';
import type { Theme } from './astrology-sidebar';

export type ExportKind = 'print' | 'pdf' | 'png';

export type ExportWorkspaceViewProps = {
	theme: Theme;
};

const EXPORT_TYPES: { id: ExportKind; labelKey: string }[] = [
	{ id: 'print', labelKey: 'export_type_print' },
	{ id: 'pdf', labelKey: 'export_type_pdf' },
	{ id: 'png', labelKey: 'export_type_png' }
];

/**
 * **Export** options (print / PDF / PNG); file pipeline still TBD.
 */
export function ExportWorkspaceView({ theme }: ExportWorkspaceViewProps) {
	const { t } = useTranslation();
	const ft = useMemo(() => getAppFormFieldTheme(theme), [theme]);

	const [exportKind, setExportKind] = useState<ExportKind>('print');
	const [includeLocation, setIncludeLocation] = useState(true);
	const [includeAspects, setIncludeAspects] = useState(true);
	const [includeInfo, setIncludeInfo] = useState(true);

	const handleExport = () => {
		toast.message(t('export'), {
			description: t('toast_export_coming_soon')
		});
	};

	return (
		<div className={cn('min-h-full p-4 md:p-6', ft.formPageBg)}>
			<div className="mx-auto max-w-2xl space-y-6">
				<div>
					<h1 className={cn('text-xl font-semibold', ft.title)}>{t('export')}</h1>
					<p className={cn('mt-1 text-sm', ft.muted)}>{t('export_include')}</p>
				</div>

				<div className={cn('rounded-xl border p-6', ft.settingsCard)}>
					<p className={cn('mb-3 text-sm font-medium', ft.label)}>{t('export_include')}</p>

					<div className="mb-6 flex flex-wrap gap-2">
						{EXPORT_TYPES.map(({ id, labelKey }) => (
							<Button
								key={id}
								type="button"
								variant={exportKind === id ? 'default' : 'outline'}
								size="sm"
								className={exportKind === id ? '' : ft.footerCancel}
								onClick={() => setExportKind(id)}
							>
								{t(labelKey)}
							</Button>
						))}
					</div>

					<div className="space-y-4">
						<div className="flex items-center gap-3">
							<Checkbox
								id="ex-loc"
								checked={includeLocation}
								onCheckedChange={(v) => setIncludeLocation(v === true)}
							/>
							<Label
								htmlFor="ex-loc"
								className={cn('cursor-pointer text-sm font-normal', ft.bodyText)}
							>
								{t('export_include_location')}
							</Label>
						</div>
						<div className="flex items-center gap-3">
							<Checkbox
								id="ex-asp"
								checked={includeAspects}
								onCheckedChange={(v) => setIncludeAspects(v === true)}
							/>
							<Label
								htmlFor="ex-asp"
								className={cn('cursor-pointer text-sm font-normal', ft.bodyText)}
							>
								{t('export_include_aspects')}
							</Label>
						</div>
						<div className="flex items-center gap-3">
							<Checkbox
								id="ex-info"
								checked={includeInfo}
								onCheckedChange={(v) => setIncludeInfo(v === true)}
							/>
							<Label
								htmlFor="ex-info"
								className={cn('cursor-pointer text-sm font-normal', ft.bodyText)}
							>
								{t('export_include_info')}
							</Label>
						</div>
					</div>

					<div className={cn('mt-8 border-t pt-6', ft.footerBorder)}>
						<Button type="button" className={ft.footerPrimary} onClick={handleExport}>
							{t('export')}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
