import { mount } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import './app.css';
import { setAspectDefinitions } from '$lib/astrology/aspects';
import { setDomainCatalog } from '$lib/astrology/domainCatalog';
import { setObservableObjectCatalog } from '$lib/astrology/observableObjects';
import { refreshCatalogGlyphs } from '$lib/stores/glyphs.svelte';
import type { DomainCatalogDto } from '$lib/tauri/types';

async function bootstrap(): Promise<void> {
  try {
		const catalog = await invoke<DomainCatalogDto>('get_builtin_domain_catalog');
    setDomainCatalog(catalog);
    setAspectDefinitions(catalog.model.aspect_definitions, catalog.model.settings?.default_aspects);
    setObservableObjectCatalog(catalog);
    refreshCatalogGlyphs();
  } catch (error) {
    console.warn('Unable to load the Rust aspect catalog.', error);
  }

  const { default: App } = await import('./App.svelte');
  mount(App, {
    target: document.getElementById('app')!
  });
}

void bootstrap();
