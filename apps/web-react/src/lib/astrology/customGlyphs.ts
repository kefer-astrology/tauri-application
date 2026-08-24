import { useSyncExternalStore } from 'react';
import { normalizeGlyphId } from './glyphs';

export interface CustomGlyphOverride {
	id: string;
	name: string;
	svg: string;
	fileName?: string;
}

const CUSTOM_GLYPHS_STORAGE_KEY = 'custom_glyphs';

function hasLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

function readStoredOverrides(): Record<string, CustomGlyphOverride> {
	if (!hasLocalStorage()) return {};
	try {
		const raw = localStorage.getItem(CUSTOM_GLYPHS_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, CustomGlyphOverride>) : {};
	} catch {
		return {};
	}
}

function persistOverrides(overrides: Record<string, CustomGlyphOverride>) {
	if (!hasLocalStorage()) return;
	try {
		localStorage.setItem(CUSTOM_GLYPHS_STORAGE_KEY, JSON.stringify(overrides));
	} catch {
		/* ignore */
	}
}

let overrides = readStoredOverrides();
const listeners = new Set<() => void>();

function emitChange() {
	listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return overrides;
}

export function setCustomGlyph(id: string, name: string, svg: string, fileName?: string) {
	const normalizedId = normalizeGlyphId(id);
	overrides = { ...overrides, [normalizedId]: { id: normalizedId, name, svg, fileName } };
	persistOverrides(overrides);
	emitChange();
}

export function resetCustomGlyph(id: string) {
	const normalizedId = normalizeGlyphId(id);
	if (!(normalizedId in overrides)) return;
	const next = { ...overrides };
	delete next[normalizedId];
	overrides = next;
	persistOverrides(overrides);
	emitChange();
}

/** Reactive read — re-renders callers whenever an override is set or reset. */
export function useCustomGlyphOverrides(): Record<string, CustomGlyphOverride> {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function resolveCustomGlyphSrc(
	overridesSnapshot: Record<string, CustomGlyphOverride>,
	id: string
): string | null {
	const override = overridesSnapshot[normalizeGlyphId(id)];
	if (!override) return null;
	return `data:image/svg+xml;utf8,${encodeURIComponent(override.svg)}`;
}
