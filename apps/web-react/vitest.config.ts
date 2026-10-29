import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			// `happy-dom` provides `window`/`localStorage`, which the i18n module reads on load.
			environment: 'happy-dom',
			include: ['src/**/*.test.ts']
		}
	})
);
