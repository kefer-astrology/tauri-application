# Kefer Astrology (desktop)

Astrology desktop app: **Tauri 2**, **React** and **Svelte** frontend workspaces (both Vite-based), and optional **Python** computation sidecar support. This repo is an **npm workspace** monorepo: the main frontend workspaces are **`apps/web-react/`** and **`apps/web-svelte/`**; native integration is in **`src-tauri/`**; Python sidecar source is expected under **`backend-python/`** when that optional backend is present.

## Documentation

Project documentation lives in **[`docs/`](docs/)** as a Hugo site source. The main entrypoints are **[`docs/content/_index.md`](docs/content/_index.md)** for Kefer Astrology, **[`docs/content/manual/_index.md`](docs/content/manual/_index.md)** for user help, **[`docs/content/developer/_index.md`](docs/content/developer/_index.md)** for shared technical contracts and development guidance, and **[`docs/content/guides/_index.md`](docs/content/guides/_index.md)** for the free-form previews and React-backed Guided Tours.

| Guide                                                        | Topic                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [frontend-react](docs/content/developer/frontend-react.md)   | Commands, `apps/web-react/` layout, Tauri bridge, i18n, assets            |
| [frontend-svelte](docs/content/developer/frontend-svelte.md) | Commands, `apps/web-svelte/` layout, shared assets, site-build behavior   |
| [ui-conventions](docs/content/developer/ui-conventions.md)   | Themes, sidebar, i18n workflow (`translations.csv` → `npm run i18n:sync`) |
| [architecture](docs/content/developer/architecture.md)       | Workspace layout, storage, Rust ↔ Python flow                             |
| [python-package](docs/content/developer/python-package.md)   | Python module and CLI used by the app                                     |

## Stack

| Layer                                                                         | Role                                                                                   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **React frontend** (`apps/web-react/src/app/`, `apps/web-react/src/main.tsx`) | Current primary desktop UI shell using Radix/shadcn-style primitives                   |
| **Svelte frontend** (`apps/web-svelte/src/`)                                  | Alternate richer frontend workspace, also built by Vite and staged into docs builds    |
| **Tauri** (`src-tauri/`)                                                      | Native window, `invoke` commands, Python sidecar lifecycle                             |
| **Python** (`backend-python/`)                                                | Optional sidecar source when present; staged binaries live under `src-tauri/binaries/` |
| **Static assets** (`static/`, repo root)                                      | Shared glyphs, app-shell icons/logos, favicon; copied into each frontend build         |

## Architecture Direction

### Motivation / Background

Kefer is moving from a Swiss-centered implementation toward a backend-pluggable astrology application. Astronomy computation should be swappable behind stable contracts, while astrology semantics such as zodiac system, house system, aspect rules, and tradition defaults stay above the astronomy backend.

JPL / SPICE is the preferred long-term runtime direction. Swiss Ephemeris remains useful as compatibility and validation infrastructure, but it should not define frontend payloads, workspace shape, or product behavior.

### Current State

- Rust/no-sidecar support is the baseline for supported desktop flows; the Python backend remains optional when provisioned.
- React and Svelte share the UI standard and are driven by contracts in `docs/content/developer/` before new behavior is implemented.
- Structured chart payloads, provenance fields, workspace defaults, and static/docs rendering are part of the current frontend/backend contract.

### Planned State

- Keep astronomy backend-pluggable, with JPL / SPICE as the preferred runtime path and Swiss Ephemeris as compatibility/validation infrastructure.
- Make backend routing clear in docs and user/debug-facing provenance: Rust-backed, Python-backed, or auto-routed.
- Remove or clearly label prototype surfaces that appear to expose computed astrology data without backend-backed provenance.

## Repo Shape

At a high level, the repo is split by responsibility:

- `apps/web-react/` contains the desktop UI. Inside `src/`, `app/` is app composition and feature wiring, `app/components/` holds feature-facing UI, `ui/` holds shared presentational React primitives, and `lib/` holds non-visual logic such as Tauri helpers, i18n setup, and app-shell metadata.
- `apps/web-svelte/` contains the alternate frontend workspace. Inside `src/`, `lib/components/` holds feature and shared Svelte UI, `lib/components/ui/` holds shared primitives, and `lib/stores/` resolves shared app-shell and glyph assets from repo-root `static/`.
- `static/` is the shared source of truth for public assets used by frontends, especially app-shell icons, logos, and glyph families.
- `src-tauri/` contains the native shell, command handlers, packaging config, and sidecar integration.
- `backend-python/`, when present, contains the optional astrology computation package and CLI that get built into the desktop sidecar.
- `docs/` is the Hugo site source for the user Manual, Developer Manual, and Guided Tour.

If you need more than this overview, start with [frontend-react](docs/content/developer/frontend-react.md) or [frontend-svelte](docs/content/developer/frontend-svelte.md) for workspace structure, then use [architecture](docs/content/developer/architecture.md) for the Rust/Python flow.

## Requirements

- **Node.js** (current LTS is fine; align with your team’s version policy).
- **Rust** toolchain for `cargo tauri dev` / `cargo tauri build` — [Install Rust](https://www.rust-lang.org/tools/install).
- **Python sidecar**: optional for the current baseline. If a staged binary exists at **`src-tauri/binaries/kefer-backend`** or **`src-tauri/binaries/kefer-backend.exe`**, Tauri can bundle and launch it. If it is missing, supported flows should still work through the Rust/no-sidecar path.

On **Windows**, install **MSVC** (“Desktop development with C++”) before Rust/Node if you build natively. On **Linux**, follow [Tauri’s Linux dependencies](https://tauri.app/start/prerequisites/) for your distro.

## Setup

```bash
git clone https://github.com/kefer-astrology/tauri-application.git
cd tauri-application
npm install
```

## Command Flows

React is the main app flow. Svelte is a separate alternate frontend flow with its own Vite and Tauri commands.

| Flow           | Command                                   | Purpose                                                                       |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| React app      | `npm run dev`                             | Run the React Vite dev server.                                                |
| React app      | `npm run tauri:dev`                       | Run the React-backed desktop app with Tauri hot reload.                       |
| React app      | `npm run build`                           | Build `apps/web-react/dist/`.                                                 |
| React app      | `npm run tauri:build`                     | Build the React-backed desktop bundle.                                        |
| React app      | `npm run check`                           | Type-check the React workspace.                                               |
| Svelte app     | `npm run dev:svelte`                      | Run the Svelte Vite dev server.                                               |
| Svelte app     | `npm run tauri:dev:svelte`                | Run the Svelte-backed desktop app with Tauri hot reload.                      |
| Svelte app     | `npm run build:svelte`                    | Build `apps/web-svelte/dist/`.                                                |
| Svelte app     | `npm run tauri:build:svelte`              | Build the Svelte-backed desktop bundle.                                       |
| Svelte app     | `npm run check:svelte`                    | Type-check the Svelte workspace.                                              |
| Site           | `npm run docs:prepare`                    | Build both frontends for browser-safe mode and stage them into the Hugo site. |
| Site           | `npm run docs:dev`                        | Prepare site assets, then run the Hugo development server.                    |
| Site           | `npm run docs:build`                      | Prepare site assets, then build the production site into `dist-docs/`.        |
| i18n           | `npm run i18n:prune:dry`                  | Show unused `translations.csv` rows not referenced by either frontend.        |
| i18n           | `npm run i18n:prune`                      | Remove unused `translations.csv` rows.                                        |
| i18n           | `npm run i18n:sync`                       | Regenerate locale JSON for both frontend workspaces from `translations.csv`.  |
| Shared         | `npm run lint`                            | Run Prettier check and ESLint.                                                |
| Python sidecar | `python scripts/build-backend-sidecar.py` | Optional: build and stage `kefer-backend` into `src-tauri/binaries/`.         |

## Troubleshooting

### Linux AppImage: white screen / `EGL_BAD_PARAMETER`

If the AppImage shows a white window and the terminal prints `Could not create default EGL display: EGL_BAD_PARAMETER`, try:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./YourApp.AppImage
```

(or `WEBKIT_DISABLE_COMPOSITING_MODE=1`). This is a known WebKitGTK issue on some Linux setups (e.g. NVIDIA, Wayland).

### Windows: Defender / SmartScreen

Unsigned Windows builds are often flagged (“unknown publisher”). Options:

1. **Code signing** — see [Tauri – Windows code signing](https://tauri.app/distribute/sign/windows) and `bundle.windows` in `src-tauri/tauri.conf.json`.
2. **Report a false positive** — [Microsoft Security Intelligence](https://www.microsoft.com/en-us/wdsi/filesubmission).
3. **MSI target** — `npm run tauri:build -- --bundles msi` can sometimes reduce false positives; MSI must be built on Windows.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file.
