import { AppearanceProvider } from './providers/appearance';
import { WorkspaceProvider } from './providers/workspace';
import { AppShell } from './shell/app-shell';

/** App root: appearance (theme, glyphs, wheel look) → workspace (charts, defaults, actions) →
 *  shell (navigation and views). */
export default function App() {
	return (
		<AppearanceProvider>
			<WorkspaceProvider>
				<AppShell />
			</WorkspaceProvider>
		</AppearanceProvider>
	);
}
