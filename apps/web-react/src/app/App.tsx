import { AppearanceProvider } from './providers/appearance';
import { RightPanelProvider } from './providers/right-panel';
import { WidgetWorkspaceProvider } from './providers/widget-workspace';
import { WorkspaceProvider } from './providers/workspace';
import { AppShell } from './shell/app-shell';

/** App root: appearance (theme, glyphs, wheel look) → workspace (charts, defaults, actions) →
 *  widget profiles → the shared right panel → shell (navigation and views). */
export default function App() {
	return (
		<AppearanceProvider>
			<WorkspaceProvider>
				<WidgetWorkspaceProvider>
					<RightPanelProvider>
						<AppShell />
					</RightPanelProvider>
				</WidgetWorkspaceProvider>
			</WorkspaceProvider>
		</AppearanceProvider>
	);
}
