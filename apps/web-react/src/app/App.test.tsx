import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// No Tauri backend in tests: every command rejects, as in the browser preview.
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.reject(new Error('no backend'))),
	isTauri: () => false
}));

describe('App', () => {
	// Server rendering runs every component and context lookup synchronously (effects do not run),
	// so a provider missing from the tree fails here instead of at runtime.
	it('renders the providers and shell', async () => {
		const { default: App } = await import('./App');
		expect(renderToString(<App />)).toContain('<main');
	}, 10_000);
});
