import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Text } from '@/app/components/ui/typography';

type Lot = {
	id: string;
	name: string;
	name_cs: string;
	reference: string;
	add: string;
	subtract: string;
	reverse_at_night: boolean;
	supported: boolean;
	note: string;
	group: string;
};
type Library = {
	lots: Lot[];
	stars: unknown[];
	hypotheticals: unknown[];
	imported_sources: string[];
	tnos: { id: string; installed: boolean }[];
	star_source: string;
	hypothetical_model: string;
	lot_source: { source: string; reference_url: string };
};

/** Installed calculation data and source/formula disclosure for the additional object catalog. */
export function PointDataSection({ onImported }: { onImported: () => Promise<void> }) {
	const { t, i18n } = useTranslation();
	const [library, setLibrary] = useState<Library | null>(null);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		let alive = true;
		void invoke<Library>('get_point_library')
			.then((data) => {
				if (alive) setLibrary(data);
			})
			.catch((err) => {
				if (alive) setError(String(err));
			});
		return () => {
			alive = false;
		};
	}, []);
	const refresh = async () => {
		await onImported();
		setLibrary(await invoke<Library>('get_point_library'));
	};
	const importDefinitions = async (file: File) => {
		setBusy(true);
		setError('');
		try {
			if (file.size > 1024 * 1024) throw new Error(t('points_package_too_large'));
			await invoke<number>('import_point_package', { json: await file.text() });
			await refresh();
			toast.success(t('points_imported'));
		} catch (err) {
			setError(String(err));
		} finally {
			setBusy(false);
		}
	};
	const importEphemeris = async () => {
		setBusy(true);
		setError('');
		try {
			const id = await invoke<string | null>('import_small_body_package');
			if (id) {
				await refresh();
				toast.success(t('points_imported'));
			}
		} catch (err) {
			setError(String(err));
		} finally {
			setBusy(false);
		}
	};
	const template = () => {
		const json = {
			schema_version: 1,
			source: 'User-defined formula',
			lots: [
				{
					id: 'lot_user_example',
					number: 1,
					name: 'Custom Fortune formula',
					name_cs: 'Vlastní formule štěstí',
					group: 'custom',
					reference: 'asc',
					add: 'moon',
					subtract: 'sun',
					reverse_at_night: true,
					supported: true,
					note: 'Example: change the name and formula before importing.'
				}
			]
		};
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'point-package-template.json';
		link.click();
		URL.revokeObjectURL(url);
	};
	return (
		<section className="space-y-3 rounded-lg border p-4">
			<Text variant="label">{t('points_data_title')}</Text>
			<Text variant="body" tone="muted">
				{t('points_data_description')}
			</Text>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="form-secondary"
					size="sm"
					disabled={busy}
					onClick={() => input.current?.click()}
				>
					{t('points_import_definitions')}
				</Button>
				<Button
					type="button"
					variant="form-secondary"
					size="sm"
					disabled={busy}
					onClick={() => void importEphemeris()}
				>
					{t('points_import_ephemeris')}
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={template}>
					{t('points_template')}
				</Button>
				<input
					ref={input}
					type="file"
					accept=".json,application/json"
					className="hidden"
					aria-label={t('points_import_definitions')}
					onChange={(event) => {
						const file = event.target.files?.[0];
						event.target.value = '';
						if (file) void importDefinitions(file);
					}}
				/>
			</div>
			{error && (
				<p role="alert" className="text-sm text-red-600">
					{error}
				</p>
			)}
			{library && (
				<>
					<Text variant="body" tone="secondary">
						{t('points_catalog_summary', {
							lots: library.lots.filter((lot) => lot.supported).length,
							total: library.lots.length,
							stars: library.stars.length,
							hypothetical: library.hypotheticals.length
						})}
					</Text>
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
						{library.tnos.map((body) => (
							<span key={body.id}>
								{t(`point_${body.id}`, { defaultValue: body.id })}:{' '}
								{t(body.installed ? 'points_installed' : 'points_not_installed')}
							</span>
						))}
					</div>
					<Text variant="caption" tone="muted">
						{t('points_coverage_hint')}
					</Text>
					<details>
						<summary className="cursor-pointer text-sm">{t('points_formulas')}</summary>
						<Text variant="caption" tone="muted">
							{library.lot_source.source}
						</Text>
						<a
							href={library.lot_source.reference_url}
							target="_blank"
							rel="noreferrer"
							className="text-sm underline"
						>
							{t('points_source')}
						</a>
						<div className="mt-2 max-h-80 space-y-3 overflow-auto">
							{library.lots.map((lot) => (
								<div key={lot.id} className="text-sm">
									<p className="font-medium">
										{i18n.language.startsWith('cs') ? lot.name_cs : lot.name}
									</p>
									{lot.supported ? (
										<p>
											{lot.reference} + {lot.add} − {lot.subtract} ·{' '}
											{t(lot.reverse_at_night ? 'points_reverse_night' : 'points_same_night')}
										</p>
									) : (
										<p>{t('points_formula_unresolved')}</p>
									)}
									{lot.note && <p className="text-xs opacity-70">{lot.note}</p>}
								</div>
							))}
						</div>
					</details>
					<Text variant="caption" tone="muted">
						{library.star_source} · {library.hypothetical_model}
					</Text>
					{library.imported_sources.length > 0 && (
						<Text variant="caption" tone="muted">
							{library.imported_sources.join(' · ')}
						</Text>
					)}
				</>
			)}
		</section>
	);
}
