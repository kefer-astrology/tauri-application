import { describe, expect, it } from 'vitest';
import {
	BUILT_IN_PRESETS,
	defaultPresetForSchool,
	addGridInstance,
	addHoroskopInstance,
	gridItems,
	instanceCount,
	presetsForSchool,
	regionInstances,
	removeInstance,
	restoreInstance,
	resolveProfile,
	withoutOrphans
} from './profiles';
import type { WidgetInstance, WorkspaceProfile } from './types';

const instance = (instanceId: string, widgetId = 'positions'): WidgetInstance => ({
	instanceId,
	widgetId,
	settings: {},
	dataContext: { kind: 'active' }
});

describe('widget profiles', () => {
	it('offers each school its own profiles', () => {
		expect(presetsForSchool('modern_western').map((p) => p.preset)).toEqual(['basic', 'modern']);
		expect(presetsForSchool('medieval_traditional').map((p) => p.preset)).toEqual([
			'traditional',
			'kabbalah'
		]);
		// No school, or one not available yet, works as the default school.
		expect(presetsForSchool(null).map((p) => p.preset)).toEqual(['basic', 'modern']);
		expect(presetsForSchool('cosmobiology').map((p) => p.preset)).toEqual(['basic', 'modern']);
		expect(defaultPresetForSchool('modern_western')).toBe('basic');
		expect(defaultPresetForSchool('medieval_traditional')).toBe('traditional');
		expect(defaultPresetForSchool(undefined)).toBe('basic');
	});

	it('defines four read-only presets, each in one school', () => {
		expect(Object.keys(BUILT_IN_PRESETS)).toEqual(['basic', 'modern', 'traditional', 'kabbalah']);
		expect(BUILT_IN_PRESETS.kabbalah).toMatchObject({
			id: 'preset:kabbalah',
			nameKey: 'widget_preset_kabbalah',
			preset: 'kabbalah',
			school: 'medieval_traditional'
		});
	});

	it('applies a workspace override section by section', () => {
		const resolved = resolveProfile({
			id: 'ws:consult',
			preset: 'traditional',
			name: 'Konzultace',
			instances: [instance('a'), instance('b', 'wheel')],
			layouts: {
				spektrum: { desktop: [{ instanceId: 'a', x: 0, y: 0, w: 6, h: 4 }] },
				horoskop: { desktop: [{ instanceId: 'b', region: 'right', order: 0 }] }
			}
		});
		expect(resolved).toMatchObject({
			id: 'ws:consult',
			name: 'Konzultace',
			nameKey: undefined,
			preset: 'traditional',
			school: 'medieval_traditional'
		});
		expect(resolved.instances.map((i) => i.instanceId)).toEqual(['a', 'b']);
		expect(resolved.layouts.spektrum.desktop).toHaveLength(1);
		// Placements of widgets the override's list no longer has are dropped…
		expect(resolved.layouts.spektrum.mobile).toEqual([]);
		// …while sections an override leaves out keep the preset's.
		const layoutOnly = resolveProfile({
			id: 'ws:layout',
			preset: 'traditional',
			layouts: { horoskop: { desktop: [] } }
		});
		expect(layoutOnly.layouts.horoskop.desktop).toEqual([]);
		expect(layoutOnly.layouts.spektrum.mobile).toEqual(
			BUILT_IN_PRESETS.traditional.layouts.spektrum.mobile
		);
		expect(resolveProfile({ id: 'x', preset: 'modern' }).nameKey).toBe('widget_preset_modern');
	});

	it('drops placements without instances and widgets this build does not know', () => {
		const profile: WorkspaceProfile = {
			...BUILT_IN_PRESETS.basic,
			instances: [instance('a'), instance('b', 'future-widget')],
			layouts: {
				horoskop: {
					desktop: [
						{ instanceId: 'a', region: 'left', order: 0 },
						{ instanceId: 'gone', region: 'left', order: 1 }
					],
					tablet: [],
					mobile: []
				},
				spektrum: {
					desktop: [{ instanceId: 'b', x: 0, y: 0, w: 4, h: 3 }],
					tablet: [],
					mobile: []
				},
				aspektarium: { desktop: [], tablet: [], mobile: [] }
			}
		};
		expect(withoutOrphans(profile).layouts.horoskop.desktop.map((p) => p.instanceId)).toEqual([
			'a'
		]);
		const known = withoutOrphans(profile, new Set(['positions']));
		expect(known.instances.map((i) => i.instanceId)).toEqual(['a']);
		expect(known.layouts.spektrum.desktop).toEqual([]);
	});

	it('starts every profile with the Horoskop base widgets', () => {
		for (const profile of Object.values(BUILT_IN_PRESETS)) {
			expect(regionInstances(profile, 'desktop', 'left').map((i) => i.widgetId)).toEqual([
				'chart-profile',
				'astrolabe'
			]);
			expect(regionInstances(profile, 'mobile', 'right').map((i) => i.widgetId)).toEqual([
				'positions'
			]);
			expect(regionInstances(profile, 'desktop', 'bottom')).toEqual([]);
		}
	});

	it('removes an instance and puts it back exactly', () => {
		const base = BUILT_IN_PRESETS.basic;
		const { profile, removed } = removeInstance(base, 'chart-profile');
		expect(regionInstances(profile, 'desktop', 'left').map((i) => i.widgetId)).toEqual([
			'astrolabe'
		]);
		expect(removeInstance(base, 'missing').removed).toBeNull();
		const restored = restoreInstance(profile, removed!);
		expect(regionInstances(restored, 'desktop', 'left').map((i) => i.widgetId)).toEqual([
			'chart-profile',
			'astrolabe'
		]);
		expect(restored.instances.map((i) => i.instanceId)).toEqual(
			base.instances.map((i) => i.instanceId)
		);
		// Restoring twice changes nothing.
		expect(restoreInstance(restored, removed!)).toBe(restored);
	});

	it('adds instances at the end of a region with unique ids', () => {
		const once = addHoroskopInstance(BUILT_IN_PRESETS.basic, 'positions', 'right');
		expect(once.instanceId).toBe('positions-2');
		const twice = addHoroskopInstance(once.profile, 'positions', 'right');
		expect(twice.instanceId).toBe('positions-3');
		expect(regionInstances(twice.profile, 'tablet', 'right').map((i) => i.instanceId)).toEqual([
			'positions',
			'positions-2',
			'positions-3'
		]);
		expect(instanceCount(twice.profile, 'positions')).toBe(3);
		const fresh = addHoroskopInstance(
			removeInstance(BUILT_IN_PRESETS.basic, 'astrolabe').profile,
			'astrolabe',
			'left'
		);
		expect(fresh.instanceId).toBe('astrolabe');
	});

	it('lays out the Aspectarium grid and adds below everything, per screen size', () => {
		const base = BUILT_IN_PRESETS.modern;
		expect(gridItems(base, 'aspektarium', 'desktop').map((i) => i.instance.widgetId)).toEqual([
			'aspect-matrix',
			'aspect-list',
			'midpoints'
		]);
		expect(gridItems(base, 'spektrum', 'desktop')).toHaveLength(14);
		const { profile, instanceId } = addGridInstance(base, 'aspektarium', 'aspect-list', {
			w: 8,
			h: 4
		});
		expect(instanceId).toBe('aspect-list-2');
		const placed = (bp: 'desktop' | 'mobile') =>
			gridItems(profile, 'aspektarium', bp).find((i) => i.instance.instanceId === instanceId)!
				.placement;
		expect(placed('desktop')).toEqual({ instanceId, x: 0, y: 14, w: 8, h: 4 });
		expect(placed('mobile')).toMatchObject({ y: 20, w: 1 });
		expect(instanceCount(profile, 'aspect-list', 'aspektarium')).toBe(2);
		expect(instanceCount(profile, 'aspect-list', 'horoskop')).toBe(0);

		const { profile: without, removed } = removeInstance(profile, 'midpoints');
		expect(
			gridItems(without, 'aspektarium', 'desktop').map((i) => i.instance.widgetId)
		).not.toContain('midpoints');
		expect(gridItems(restoreInstance(without, removed!), 'aspektarium', 'tablet')).toHaveLength(4);
	});

	it('lays out Spektrum: wheel and highlights across, cards two per row on tablet', () => {
		const tablet = gridItems(BUILT_IN_PRESETS.basic, 'spektrum', 'tablet');
		expect(tablet.slice(0, 2).map((i) => [i.instance.widgetId, i.placement.w])).toEqual([
			['spektrum-wheel', 6],
			['highlights', 6]
		]);
		expect(tablet.slice(2, 4).map((i) => [i.placement.x, i.placement.w])).toEqual([
			[0, 3],
			[3, 3]
		]);
		const mobile = gridItems(BUILT_IN_PRESETS.basic, 'spektrum', 'mobile');
		expect(mobile.every((i) => i.placement.w === 1 && i.placement.x === 0)).toBe(true);
		// No two cards overlap on a narrow screen.
		const ys = mobile.map((i) => [i.placement.y, i.placement.y + i.placement.h]);
		ys.slice(1).forEach(([start], index) => expect(start).toBeGreaterThanOrEqual(ys[index]![1]!));
	});
});
