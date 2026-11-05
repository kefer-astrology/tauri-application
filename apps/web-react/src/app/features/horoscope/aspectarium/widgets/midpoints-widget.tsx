import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { Heading, Text } from '@/app/components/ui/typography';
import { WidgetFrame } from '@/app/views/data/widget-frame';
import { MidpointContactTable, MidpointTable } from '@/app/views/domain/midpoint-tables';
import { normalizeLongitude } from '@/lib/astrology/chartSearch';
import {
	MIDPOINT_CONTACT_ASPECT_IDS,
	type Midpoint,
	type MidpointContact
} from '@/lib/astrology/midpoints';
import { chartDataToComputePayload } from '@/lib/tauri/chartPayload';
import { computeMidpointContactsFromData, computeMidpointsFromData } from '@/lib/tauri/workspace';
import type { WidgetInstance } from '@/lib/widgets/types';
import { useWidgetChrome } from '../../workspace/use-widget-chrome';
import { useAspectarium } from '../aspectarium-context';
import { useAspectariumLabels } from '../use-aspectarium-labels';

/** Midpoints of the filtered bodies and the objects in aspect to them, by the chosen contact
 *  aspects. Computed by the backend. */
export function MidpointsWidget({ instance }: { instance: WidgetInstance }) {
	const { t } = useTranslation();
	const { chart, bodyIds, workspaceDefaults } = useAspectarium();
	const labels = useAspectariumLabels();
	const title = t('aspectarium_view_midpoints', { defaultValue: 'Midpoints' });
	const chrome = useWidgetChrome(instance, title);
	const [contactAspects, setContactAspects] = useState<Set<string>>(
		() => new Set(MIDPOINT_CONTACT_ASPECT_IDS)
	);
	const [midpoints, setMidpoints] = useState<Midpoint[]>([]);
	const [contacts, setContacts] = useState<MidpointContact[]>([]);

	useEffect(() => {
		if (!chart) return;
		const positions = (chart.computed?.positions ?? {}) as Record<string, unknown>;
		const ids = Array.from(bodyIds);
		const longitudes: Record<string, number> = {};
		for (const id of ids) {
			const longitude = normalizeLongitude(positions[id]);
			if (longitude !== null) longitudes[id] = longitude;
		}
		let cancelled = false;
		void computeMidpointsFromData(longitudes, ids, chart.id ?? null).then((computed) => {
			if (cancelled) return;
			setMidpoints(computed);
			void computeMidpointContactsFromData(
				chartDataToComputePayload(chart, workspaceDefaults),
				computed,
				longitudes,
				Array.from(contactAspects)
			).then((found) => {
				if (!cancelled) setContacts(found);
			});
		});
		return () => {
			cancelled = true;
		};
	}, [chart, bodyIds, contactAspects, workspaceDefaults]);

	return (
		<WidgetFrame {...chrome} title={title} bodyClassName="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
				<Text variant="eyebrow" as="span" tone="muted" className="font-semibold">
					{t('aspectarium_midpoint_contact_aspects', { defaultValue: 'Contact aspects' })}
				</Text>
				{MIDPOINT_CONTACT_ASPECT_IDS.map((aspectId) => (
					<Label
						variant="compact"
						tone="secondary"
						key={aspectId}
						className="flex cursor-pointer items-center gap-1.5"
					>
						<Checkbox
							checked={contactAspects.has(aspectId)}
							onCheckedChange={(checked) =>
								setContactAspects((prev) => {
									const next = new Set(prev);
									if (checked === true) next.add(aspectId);
									else next.delete(aspectId);
									return next;
								})
							}
						/>
						{labels.aspectLabel(aspectId)}
					</Label>
				))}
			</div>

			<div>
				<Heading variant="panelTitle" level={3} className="mb-2">
					{title}
				</Heading>
				<MidpointTable
					midpoints={midpoints}
					bodyLabel={labels.bodyLabel}
					labels={{
						pair: t('aspectarium_midpoint_pair', { defaultValue: 'Pair' }),
						position: t('aspectarium_position', { defaultValue: 'Position' }),
						opposite: t('aspectarium_midpoint_opposite', { defaultValue: 'Opposite' }),
						ambiguous: t('aspectarium_midpoint_ambiguous', { defaultValue: 'ambiguous' }),
						ambiguousHint: t('aspectarium_midpoint_ambiguous_hint', {
							defaultValue: 'These objects are ~180° apart — both positions are equally valid.'
						})
					}}
					empty={
						<Text variant="body" tone="muted">
							{t('aspectarium_no_midpoints', {
								defaultValue: 'Select at least two objects to see their midpoints.'
							})}
						</Text>
					}
				/>
			</div>

			<div>
				<Heading variant="panelTitle" level={3} className="mb-2">
					{t('aspectarium_midpoint_contacts_title', { defaultValue: 'Contacts' })}
				</Heading>
				<MidpointContactTable
					contacts={contacts}
					bodyLabel={labels.bodyLabel}
					aspectLabel={labels.aspectLabel}
					labels={{
						object: t('aspectarium_midpoint_contact_object', { defaultValue: 'Object' }),
						pair: t('aspectarium_midpoint_pair', { defaultValue: 'Pair' }),
						aspect: t('aspectarium_aspect', { defaultValue: 'Aspect' }),
						orb: t('label_orb')
					}}
					empty={
						<Text variant="body" tone="muted">
							{t('aspectarium_no_midpoint_contacts', {
								defaultValue: 'No contacts found within orb.'
							})}
						</Text>
					}
				/>
			</div>
		</WidgetFrame>
	);
}
