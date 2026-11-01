# Kefer Astrology

Kefer is a desktop astrology application built with Tauri 2 and Rust. React is
the default frontend; Svelte is an alternate shell in the same npm workspace.
Supported calculations run in Rust without a Python sidecar. The optional
Python backend source is not included in this checkout.

## Documentation

| I want to… | Start here |
| --- | --- |
| Use the application | [Manual](docs/content/manual/_index.md) |
| Explore the browser previews and Guided Tours | [Guides](docs/content/guides/_index.md) |
| Contribute or find the right contract | [Developer Manual](docs/content/developer/_index.md) |
| Understand runtime boundaries and backend routing | [Architecture](docs/content/developer/architecture.md) |
| Work on a frontend | [React](docs/content/developer/frontend-react.md) · [Svelte](docs/content/developer/frontend-svelte.md) |

Browser previews demonstrate the interface. Native dialogs, workspace
persistence, and backend calculations require the desktop application.

## Run locally

Install Node.js and npm, Rust, and the platform dependencies required by Tauri.
The repository's CI uses **Node.js 22** and **stable Rust**. Windows builds need
MSVC's “Desktop development with C++” workload; Linux builds need the packages
listed in [Tauri's prerequisites](https://tauri.app/start/prerequisites/).

From a checkout of this repository:

```bash
npm ci
npm run tauri:dev
```

To develop the interface in a browser, use `npm run dev`. Backend-dependent
features need the Tauri desktop runtime.

## Common commands

Run these from the repository root:

| Task | React (default) | Svelte |
| --- | --- | --- |
| Browser dev server | `npm run dev` | `npm run dev:svelte` |
| Desktop app with hot reload | `npm run tauri:dev` | `npm run tauri:dev:svelte` |
| Frontend build | `npm run build` | `npm run build:svelte` |
| Desktop bundle | `npm run tauri:build` | `npm run tauri:build:svelte` |
| Type check | `npm run check` | `npm run check:svelte` |

Other shared commands:

```bash
# React tests (Vitest)
npm test

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml --lib

# Formatting and ESLint
npm run lint

# Regenerate both frontends' locales after editing translations.csv
npm run i18n:sync
```

See [Testing strategy](docs/content/developer/testing-strategy.md) for coverage,
optional resource requirements, and known automation gaps. React and Svelte
have different feature coverage; see the frontend references before assuming
parity.

## Work on the documentation

Markdown source lives in `docs/content/`. Install Hugo to preview or build the
site; the documentation workflow pins **Hugo Extended 0.165.0**.

```bash
npm run docs:dev
npm run docs:build
```

Both commands first build the React and Svelte browser previews and stage them
under `docs/static/apps/`. The production site is written to `dist-docs/`.
After preparing the previews once, content-only edits can use Hugo directly
without rebuilding the frontends:

```bash
hugo server --source docs
```

Edit source Markdown and shared assets rather than generated copies under
`docs/public/`, `docs/static/apps/`, or `docs/data/generated/`. See the
[contribution guide](docs/content/developer/project-context.md) for ownership
and publishing rules.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web-react/` | Default React + Vite desktop frontend |
| `apps/web-svelte/` | Alternate Svelte + Vite frontend |
| `src-tauri/` | Native shell, commands, workspace persistence, and Rust calculation |
| `contracts/` | Shared contract fixtures |
| `static/` | Shared glyphs, shell icons, logos, and favicon |
| `docs/` | Hugo source, templates, and documentation assets |
| `scripts/` | Asset, translation, fixture, and build tooling |

The optional Python source belongs under `backend-python/` when provisioned.
`python scripts/build-backend-sidecar.py` builds and stages that sidecar; it
requires the missing Python source and is not part of normal Rust-only setup.

For more detail, see the Mermaid maps for
[application structure](docs/diagrams/application-structure.mmd),
[code navigation](docs/diagrams/code-navigation.mmd), and
[Rust modules](docs/diagrams/rust-code-map.mmd).

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
