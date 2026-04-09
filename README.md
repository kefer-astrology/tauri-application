# Kefer Astrology (desktop)

Astrology desktop app: **Tauri 2**, **React** (Vite, Radix/shadcn-style UI), and a **Python** computation sidecar. This repo is an **npm workspace** monorepo: the React UI is **`apps/web-react/`**; native integration is in **`src-tauri/`**; chart logic is in **`backend-python/`**.

## Documentation

Project docs are in **[`docs/README.md`](docs/README.md)** (index and reading order). Start there for architecture, React/Tauri wiring, UI conventions, Python package notes, and integration examples.

| Guide                                       | Topic                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| [FRONTEND_REACT.md](docs/FRONTEND_REACT.md) | Commands, `apps/web-react/` layout, Tauri bridge, i18n, assets            |
| [UI_CONVENTIONS.md](docs/UI_CONVENTIONS.md) | Themes, sidebar, i18n workflow (`translations.csv` → `npm run i18n:sync`) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)     | Workspace layout, storage, Rust ↔ Python flow                             |
| [PYTHON_PACKAGE.md](docs/PYTHON_PACKAGE.md) | Python module and CLI used by the app                                     |

## Stack

| Layer                                                                | Role                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **React** (`apps/web-react/src/app/`, `apps/web-react/src/main.tsx`) | UI shell (Radix + MUI where used)                                          |
| **Tauri** (`src-tauri/`)                                             | Native window, `invoke` commands, Python sidecar lifecycle                 |
| **Python** (`backend-python/`)                                       | Ephemeris / chart computation (sidecar binary under `src-tauri/binaries/`) |
| **Static assets** (`static/`, repo root)                               | Shared glyphs, favicon; served at `/glyphs/...` in dev and copied into each app’s build |

## Requirements

- **Node.js** (current LTS is fine; align with your team’s version policy).
- **Rust** toolchain for `cargo tauri dev` / `cargo tauri build` — [Install Rust](https://www.rust-lang.org/tools/install).
- **Python sidecar**: the desktop build expects a binary at **`src-tauri/binaries/kefer-backend`** (see `src-tauri/tauri.conf.json` `bundle.resources`). If it is missing, restore or rebuild it before running the full app; details are in [FRONTEND_REACT.md](docs/FRONTEND_REACT.md) and [PYTHON_PACKAGE.md](docs/PYTHON_PACKAGE.md).

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
npm run i18n:sync        # Regenerate apps/web-react/src/locales/*.json from translations.csv
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
