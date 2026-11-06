import { ActionBar } from '@/app/components/ui/container';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMainContentContainer, AppMainContentRoot } from '@/app/components/ui/app-main-content';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { useAppearance } from '@/app/providers/appearance';
import type { ElementColors } from '@/lib/astrology/elementColors';
import type { ThemePalette } from '@/lib/themePalettes';
import type { SettingsSectionId } from './settings-secondary-sidebar';
import { SettingsDraftContext, type SettingsDraftValue } from './settings-draft';
import { JanKeferSection, ManualSection } from './sections/about-sections';
import { AppLayoutSection } from './sections/app-layout-section';
import { AspectSettingsSection } from './sections/aspect-settings-section';
import { HouseSystemSection } from './sections/house-system-section';
import { LanguageLocationSection } from './sections/language-location-section';
import { ObservableObjectsSection } from './sections/observable-objects-section';
import { SymbolLayoutSection } from './sections/symbol-layout-section';

const SECTIONS: Record<SettingsSectionId, () => React.ReactNode> = {
	jazyk_lokace: LanguageLocationSection,
	system_domu: HouseSystemSection,
	pozorovane_objekty: ObservableObjectsSection,
	nastaveni_aspektu: AspectSettingsSection,
	rozlozeni_symbolu: SymbolLayoutSection,
	rozlozeni_aplikace: AppLayoutSection,
	jan_kefer: JanKeferSection,
	manual: ManualSection
};

/**
 * Settings: the active section and one Confirm action. Sections read and change the appearance and
 * workspace providers directly; most changes apply at once. Element colors and the theme palette
 * are drafts applied by Confirm; leaving Settings discards unconfirmed drafts and local input.
 */
export function SettingsView({ section }: { section: SettingsSectionId }) {
	const { t } = useTranslation();
	const { elementColors, commitElementColors, themePalette, commitThemePalette } = useAppearance();
	const [changed, setChanged] = useState(false);
	const [elementDraft, setElementDraftState] = useState<ElementColors>(elementColors);
	const [paletteDraft, setPaletteDraftState] = useState<ThemePalette>(themePalette);

	useEffect(() => setElementDraftState(elementColors), [elementColors]);
	useEffect(() => setPaletteDraftState(themePalette), [themePalette]);

	const markChanged = useCallback(() => setChanged(true), []);
	const draft = useMemo<SettingsDraftValue>(
		() => ({
			markChanged,
			elementDraft,
			setElementDraft: setElementDraftState,
			paletteDraft,
			setPaletteDraft: setPaletteDraftState
		}),
		[markChanged, elementDraft, paletteDraft]
	);

	const confirm = () => {
		commitElementColors(elementDraft);
		commitThemePalette(paletteDraft);
		setChanged(false);
	};

	const Section = SECTIONS[section];

	return (
		<SettingsDraftContext.Provider value={draft}>
			<AppMainContentRoot className="min-h-full">
				<AppMainContentContainer width="wide">
					<div className="flex min-h-0 w-full min-w-0 flex-col space-y-6">
						<Card
							spacing="flush"
							variant="ghost"
							className="flex min-h-[min(70vh,520px)] min-w-0 flex-col rounded-xl p-0 shadow-none"
						>
							<CardContent className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
								<Section key={section} />
							</CardContent>
							<ActionBar border="none" layout="responsive" className="md:px-8">
								<Button
									variant="form-primary"
									size="form"
									type="button"
									className="flex-1"
									onClick={confirm}
									disabled={!changed}
								>
									{t('confirm')}
								</Button>
							</ActionBar>
						</Card>
					</div>
				</AppMainContentContainer>
			</AppMainContentRoot>
		</SettingsDraftContext.Provider>
	);
}
