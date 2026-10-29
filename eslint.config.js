import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
	{
		ignores: [
			'dist/**',
			'apps/**/dist/**',
			'node_modules/**',
			'src-tauri/**',
			'backend-python/**',
			'.codex/**',
			// Committed Hugo build output (bundled app builds included).
			'docs/public/**'
		]
	},
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	prettier,
	{
		rules: {
			'no-undef': 'off',
			// A leading underscore marks an intentionally unused binding (e.g. a prop stripped
			// before spreading the rest).
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			]
		},
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parserOptions: {
				projectService: true
			}
		}
	},
	{
		files: ['apps/web-react/**/*.{ts,tsx}'],
		plugins: { 'react-hooks': reactHooks },
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn'
		}
	}
);
