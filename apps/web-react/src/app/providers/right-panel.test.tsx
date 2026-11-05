import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n/i18n';
import { AppThemeProvider } from '@/app/providers/app-theme';
import { DetailSidePanel } from '@/app/views/data/detail-side-panel';
import { RightPanelProvider } from './right-panel';

// React only batches `act` updates when this flag is set.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** An edit panel whose content opens a second (tag) panel, like the edit-chart form. */
function EditWithTags() {
	const [editOpen, setEditOpen] = useState(false);
	const [tagsOpen, setTagsOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setEditOpen(true)}>
				open edit
			</button>
			<DetailSidePanel
				open={editOpen}
				onOpenChange={setEditOpen}
				title="Edit chart"
				contentClassName="wide-panel"
			>
				<input aria-label="name" defaultValue="" />
				<button type="button" onClick={() => setTagsOpen(true)}>
					open tags
				</button>
				<DetailSidePanel open={tagsOpen} onOpenChange={setTagsOpen} title="Tags">
					<p>tag editor</p>
				</DetailSidePanel>
			</DetailSidePanel>
		</>
	);
}

let container: HTMLDivElement;
let root: Root;

const click = (element: Element | null | undefined) =>
	act(() => {
		(element as HTMLElement).click();
	});
const byText = (text: string) =>
	[...document.querySelectorAll('button')].find((b) => b.textContent === text);
const dialogs = () => document.querySelectorAll('[role="dialog"]');
const title = () => document.querySelector('[role="dialog"] h2')?.textContent;
const visibleBody = () =>
	[...document.querySelectorAll('[role="dialog"] [data-slot="surface"]')].filter(
		(el) => !(el as HTMLElement).hidden
	);

describe('RightPanelProvider', () => {
	beforeAll(() => i18n.changeLanguage('en'));

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
		act(() =>
			root.render(
				<AppThemeProvider theme="noon" glyphSet="default">
					<RightPanelProvider>
						<EditWithTags />
					</RightPanelProvider>
				</AppThemeProvider>
			)
		);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('shows a nested view on top of the open one, in one panel, and goes back', () => {
		click(byText('open edit'));
		expect(dialogs()).toHaveLength(1);
		expect(title()).toBe('Edit chart');

		const name = document.querySelector('input[aria-label="name"]') as HTMLInputElement;
		act(() => {
			name.value = 'Jan';
		});
		click(byText('open tags'));

		expect(dialogs()).toHaveLength(1);
		expect(title()).toBe('Tags');
		expect(visibleBody()).toHaveLength(1);
		expect(visibleBody()[0]!.textContent).toBe('tag editor');
		// The view underneath keeps its width and its unsaved input.
		expect(document.querySelector('[role="dialog"]')!.className).toContain('wide-panel');
		expect((document.querySelector('input[aria-label="name"]') as HTMLInputElement).value).toBe(
			'Jan'
		);

		click(document.querySelector('[role="dialog"] button[aria-label="Back"]'));
		expect(title()).toBe('Edit chart');
		expect(document.querySelector('[role="dialog"] button[aria-label="Back"]')).toBeNull();
		expect((document.querySelector('input[aria-label="name"]') as HTMLInputElement).value).toBe(
			'Jan'
		);
	});

	it('goes back one view on Escape and closes everything with the close button', () => {
		click(byText('open edit'));
		click(byText('open tags'));
		act(() => {
			document
				.querySelector('[role="dialog"]')!
				.dispatchEvent(
					new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
				);
		});
		expect(title()).toBe('Edit chart');

		click(byText('open tags'));
		const close = [...document.querySelectorAll('[role="dialog"] button')].find(
			(b) => b.textContent?.trim() === 'Close'
		);
		click(close);
		expect(dialogs()).toHaveLength(0);
	});
});
