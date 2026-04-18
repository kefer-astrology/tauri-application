# Kefer Astrology (desktop)

Astrology desktop app: **Tauri 2**, **React** and **Svelte** frontend workspaces (both Vite-based), and a **Python** computation sidecar. This repo is an **npm workspace** monorepo: the main frontend workspaces are **`apps/web-react/`** and **`apps/web-svelte/`**; native integration is in **`src-tauri/`**; chart logic is in **`backend-python/`**.

## Documentation

Project docs live in **[`docs/`](docs/)** as a Hugo site source. The main entrypoints are **[`docs/content/_index.md`](docs/content/_index.md)** for the site landing page, **[`docs/content/docs/_index.md`](docs/content/docs/_index.md)** for the documentation index, and **[`docs/content/llm/_index.md`](docs/content/llm/_index.md)** for LLM continuation notes.

| Guide                                       | Topic                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| [frontend-react](docs/content/docs/frontend-react.md) | Commands, `apps/web-react/` layout, Tauri bridge, i18n, assets            |
| [frontend-svelte](docs/content/docs/frontend-svelte.md) | Commands, `apps/web-svelte/` layout, shared assets, docs-build behavior   |
| [ui-conventions](docs/content/docs/ui-conventions.md) | Themes, sidebar, i18n workflow (`translations.csv` → `npm run i18n:sync`) |
| [architecture](docs/content/docs/architecture.md)     | Workspace layout, storage, Rust ↔ Python flow                             |
| [python-package](docs/content/docs/python-package.md) | Python module and CLI used by the app                                     |

## Stack

| Layer | Role |
| --- | --- |
| **React frontend** (`apps/web-react/src/app/`, `apps/web-react/src/main.tsx`) | Current primary desktop UI shell (Radix/shadcn-style primitives, MUI where already used) |
| **Svelte frontend** (`apps/web-svelte/src/`) | Alternate richer frontend workspace, also built by Vite and staged into docs builds |
| **Tauri** (`src-tauri/`) | Native window, `invoke` commands, Python sidecar lifecycle |
| **Python** (`backend-python/`) | Ephemeris / chart computation (sidecar binary under `src-tauri/binaries/`) |
| **Static assets** (`static/`, repo root) | Shared glyphs, app-shell icons/logos, favicon; copied into each frontend build |

## Repo Shape

At a high level, the repo is split by responsibility:

- `apps/web-react/` contains the desktop UI. Inside `src/`, `app/` is app composition and feature wiring, `app/components/` holds feature-facing UI, `ui/` holds shared presentational React primitives, and `lib/` holds non-visual logic such as Tauri helpers, i18n setup, and app-shell metadata.
- `apps/web-svelte/` contains the alternate frontend workspace. Inside `src/`, `lib/components/` holds feature and shared Svelte UI, `lib/components/ui/` holds shared primitives, and `lib/stores/` resolves shared app-shell and glyph assets from repo-root `static/`.
- `static/` is the shared source of truth for public assets used by frontends, especially app-shell icons, logos, and glyph families.
- `src-tauri/` contains the native shell, command handlers, packaging config, and sidecar integration.
- `backend-python/` contains the astrology computation package and CLI that get built into the desktop sidecar.
- `docs/` is the Hugo documentation site source, including both developer docs and LLM continuation notes.

If you need more than this overview, start with [frontend-react](docs/content/docs/frontend-react.md) or [frontend-svelte](docs/content/docs/frontend-svelte.md) for workspace structure, then use [architecture](docs/content/docs/architecture.md) for the Rust/Python flow.

## Requirements

- **Node.js** (current LTS is fine; align with your team’s version policy).
- **Rust** toolchain for `cargo tauri dev` / `cargo tauri build` — [Install Rust](https://www.rust-lang.org/tools/install).
- **Python sidecar**: desktop packaging expects the sidecar to be staged inside **`src-tauri/binaries/`** as `kefer-backend` or `kefer-backend.exe`. If it is missing, rebuild it before running the full app; details are in [frontend-react](docs/content/docs/frontend-react.md) and [python-package](docs/content/docs/python-package.md).

On **Windows**, install **MSVC** (“Desktop development with C++”) before Rust/Node if you build natively. On **Linux**, follow [Tauri’s Linux dependencies](https://tauri.app/start/prerequisites/) for your distro.

## Setup

```bash
git clone https://github.com/kefer-astrology/tauri-application-react.git
cd tauri-application-react
npm install
```

## Commands

```bash
npm run dev              # Vite only → http://localhost:1420
npm run tauri dev        # Desktop app with hot reload
npm run build            # Frontend → apps/web-react/dist/
npm run tauri build      # Full app bundle
npm run check            # TypeScript (app + Vite config)
npm run lint             # Prettier + ESLint
npm run docs:prepare     # Build app frontends and stage them into the Hugo site
npm run docs:dev         # Hugo dev server for docs/
npm run docs:build       # Production Hugo build → dist-docs/
npm run i18n:sync        # Regenerate apps/web-react/src/locales/*.json from translations.csv
python scripts/build-backend-sidecar.py  # Build and stage kefer-backend into src-tauri/binaries/
```

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
3. **MSI target** — `npm run tauri build -- --bundles msi` can sometimes reduce false positives; MSI must be built on Windows.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file.
