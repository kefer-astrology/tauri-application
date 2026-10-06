import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { I18nextProvider } from 'react-i18next';
import { setAspectDefinitions } from './lib/astrology/aspects';
import { setDomainCatalog } from './lib/astrology/domainCatalog';
import { setObservableObjectCatalog } from './lib/astrology/observableObjects';
import i18n from './lib/i18n/i18n';
import type { DomainCatalogDto } from './lib/tauri/types';
import './styles/index.css';

async function bootstrap(): Promise<void> {
	try {
		const catalog = await invoke<DomainCatalogDto>('get_builtin_domain_catalog');
		setDomainCatalog(catalog);
		setAspectDefinitions(catalog.model.aspect_definitions, catalog.model.settings?.default_aspects);
		setObservableObjectCatalog(catalog);
	} catch (error) {
		console.warn('Unable to load the Rust aspect catalog.', error);
	}

	const { default: App } = await import('./app/App');
	createRoot(document.getElementById('root')!).render(
		<I18nextProvider i18n={i18n}>
			<App />
		</I18nextProvider>
	);
}

void bootstrap();
