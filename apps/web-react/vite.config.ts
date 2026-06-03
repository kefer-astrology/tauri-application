import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const publicBase = process.env.VITE_PUBLIC_BASE || '/';

export default defineConfig({
	base: publicBase,
	// Shared public assets for all frontends (glyphs, favicon, …) — repo root `static/`
	publicDir: path.resolve(__dirname, '../../static'),
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	},
	assetsInclude: ['**/*.svg', '**/*.csv'],
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
		watch: {
			ignored: ['../../src-tauri/**']
		}
	},
	envPrefix: ['VITE_', 'TAURI_ENV_*'],
	build: {
		target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
		minify: !process.env.TAURI_ENV_DEBUG ? 'oxc' : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG,
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: 'react-vendor',
							test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
							priority: 30
						},
						{
							name: 'radix-vendor',
							test: /node_modules[\\/]@radix-ui[\\/]/,
							priority: 20
						},
						{
							name: 'ui-vendor',
							test: /node_modules[\\/](lucide-react|cmdk|sonner|vaul|react-day-picker|date-fns)[\\/]/,
							priority: 15
						},
						{
							name: 'i18n-vendor',
							test: /node_modules[\\/](i18next|react-i18next)[\\/]/,
							priority: 10
						},
						{
							name: 'vendor',
							test: /node_modules[\\/]/,
							maxSize: 300 * 1024
						}
					]
				}
			}
		}
	}
});
