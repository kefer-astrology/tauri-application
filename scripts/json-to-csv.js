#!/usr/bin/env node
/**
 * Recovery helper: rebuild translations.csv from generated React locale JSON.
 *
 * Normal workflow is CSV -> locale JSON via `npm run i18n:sync`.
 * Columns: internal_name, czech, english, french, spanish
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const localeDir = path.join(rootDir, 'apps/web-react/src/locales');
const localeSpecs = [
	['czech', 'cs.json'],
	['english', 'en.json'],
	['french', 'fr.json'],
	['spanish', 'es.json']
];

const bundles = Object.fromEntries(
	localeSpecs.map(([column, fileName]) => [
		column,
		JSON.parse(fs.readFileSync(path.join(localeDir, fileName), 'utf8'))
	])
);

function escapeCsv(val) {
	if (val == null) return '""';
	const s = String(val);
	if (/[",\n\r]/.test(s)) {
		return '"' + s.replace(/"/g, '""') + '"';
	}
	return '"' + s + '"';
}

const keys = Array.from(
	new Set(Object.values(bundles).flatMap((bundle) => Object.keys(bundle)))
).sort();
const header = 'internal_name,czech,english,french,spanish';
const rows = [header];

for (const key of keys) {
	const row = [
		key,
		bundles.czech[key] ?? '',
		bundles.english[key] ?? '',
		bundles.french[key] ?? '',
		bundles.spanish[key] ?? ''
	]
		.map(escapeCsv)
		.join(',');
	rows.push(row);
}

const csv = rows.join('\n');
fs.writeFileSync(path.join(rootDir, 'translations.csv'), csv, 'utf8');
console.log('Wrote translations.csv with', keys.length, 'rows');
