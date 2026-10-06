import { mount } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import './app.css';
import { setAspectDefinitions } from '$lib/astrology/aspects';
import type { AspectDefinitionDto } from '$lib/tauri/types';

async function bootstrap(): Promise<void> {
  try {
    const definitions = await invoke<AspectDefinitionDto[]>('get_builtin_aspect_catalog');
    setAspectDefinitions(definitions);
  } catch (error) {
    console.warn('Unable to load the Rust aspect catalog.', error);
  }

  const { default: App } = await import('./App.svelte');
  mount(App, {
    target: document.getElementById('app')!
  });
}

void bootstrap();
