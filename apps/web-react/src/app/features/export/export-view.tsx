import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/ui/app-main-content';
import { useAppFormFieldTheme } from '@/app/components/form-field-theme';

type ExportKind = 'print' | 'pdf' | 'png';

const EXPORT_TYPES: { id: ExportKind; labelKey: string }[] = [
	{ id: 'print', labelKey: 'export_type_print' },
	{ id: 'pdf', labelKey: 'export_type_pdf' },
	{ id: 'png', labelKey: 'export_type_png' }
];

type ExportPart = 'location' | 'aspects' | 'info';

const EXPORT_PARTS: { id: ExportPart; inputId: string; labelKey: string }[] = [
	{ id: 'location', inputId: 'ex-loc', labelKey: 'export_include_location' },
	{ id: 'aspects', inputId: 'ex-asp', labelKey: 'export_include_aspects' },
	{ id: 'info', inputId: 'ex-info', labelKey: 'export_include_info' }
];

/** Export options (print / PDF / PNG and what to include); the export itself is not available
 *  yet. */
export function ExportView() {
	const { t } = useTranslation();
	const ft = useAppFormFieldTheme();
	const [exportKind, setExportKind] = useState<ExportKind>('print');
	const [included, setIncluded] = useState<Record<ExportPart, boolean>>({
		location: true,
		aspects: true,
		info: true
	});

	const handleExport = () => {
		toast.message(t('export'), { description: t('toast_export_coming_soon') });
	};

	return (
		<AppMainContentRoot className={ft.formPageBg}>
			<AppMainContentContainer width="standard" className="space-y-6">
				<div>
					<h1 className={cn('text-xl font-semibold', ft.title)}>{t('export')}</h1>
					<p className={cn('mt-1 text-sm', ft.muted)}>{t('export_include')}</p>
				</div>

				<Card variant="ghost" className="rounded-xl">
					<CardContent className="space-y-6 p-6">
						<p className={cn('text-sm font-medium', ft.label)}>{t('export_include')}</p>

						<div className="flex gap-2">
							{EXPORT_TYPES.map(({ id, labelKey }) => (
								<Button
									key={id}
									type="button"
									variant={exportKind === id ? 'default' : 'outline'}
									size="sm"
									className={cn(
										'min-w-0 flex-1',
										exportKind === id ? '' : cn(ft.footerCancel, 'rounded-lg px-3 py-0')
									)}
									onClick={() => setExportKind(id)}
								>
									{t(labelKey)}
								</Button>
							))}
						</div>

						<div className="space-y-4">
							{EXPORT_PARTS.map((part) => (
								<div key={part.id} className="flex items-center gap-3">
									<Checkbox
										id={part.inputId}
										checked={included[part.id]}
										onCheckedChange={(value) =>
											setIncluded((prev) => ({ ...prev, [part.id]: value === true }))
										}
									/>
									<Label
										htmlFor={part.inputId}
										className={cn('cursor-pointer text-sm font-normal', ft.bodyText)}
									>
										{t(part.labelKey)}
									</Label>
								</div>
							))}
						</div>

						<div className="pt-2">
							<Button type="button" className={ft.footerPrimary} onClick={handleExport}>
								{t('export')}
							</Button>
						</div>
					</CardContent>
				</Card>
			</AppMainContentContainer>
		</AppMainContentRoot>
	);
}
