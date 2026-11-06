import { Text } from '@/app/components/ui/typography';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';

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

/** Export sheet content. Format/include options are available; export execution is not yet implemented. */
export function ExportView() {
	const { t } = useTranslation();
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
		<Card variant="ghost" className="rounded-xl">
			<CardContent className="space-y-6 p-0">
				<Text variant="label" tone="secondary">
					{t('export_include')}
				</Text>

				<div className="flex flex-wrap gap-2">
					{EXPORT_TYPES.map(({ id, labelKey }) => (
						<Button
							key={id}
							type="button"
							variant={exportKind === id ? 'default' : 'form-secondary'}
							size="sm"
							className="min-w-0 flex-1 rounded-lg py-0"
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
								variant="default"
								tone="secondary"
								htmlFor={part.inputId}
								className="cursor-pointer font-normal"
							>
								{t(part.labelKey)}
							</Label>
						</div>
					))}
				</div>

				<div className="pt-2">
					<Button
						variant="form-primary"
						size="form"
						type="button"
						className="flex-1"
						onClick={handleExport}
					>
						{t('export')}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
