import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const publicBase = process.env.VITE_PUBLIC_BASE || '/';

export default defineConfig({
	base: publicBase,
	publicDir: path.resolve(__dirname, '../../static'),
	plugins: [svelte(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			$lib: path.resolve(__dirname, './src/lib')
		}
	},
	server: {
		port: 1422,
		strictPort: true,
		host: host || false,
		hmr: host ? { protocol: 'ws', host, port: 1423 } : undefined,
		watch: {
			ignored: ['../../src-tauri/**']
		}
	},
	envPrefix: ['VITE_', 'TAURI_ENV_*'],
	build: {
		target: 'es2020',
		minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG
	}
});
