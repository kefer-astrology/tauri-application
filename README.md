# Tauri 2 Svelte 5 Shadcn

Simple boilerplate for Tauri 2 with Svelte 5 (and shadcn-svelte).

## Requirements

In order to run this boilerplate, you need to install Node (via nvm) and Rust. If you are on Windows I also recommend installing MSVC before the other dependencies (make sure to check the "Desktop development with C++" workload).

Some useful links:

- https://github.com/coreybutler/nvm-windows/releases (Windows: pick the nvm installer)
- https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating (Linux: run `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`)
- https://www.rust-lang.org/tools/install
- https://visualstudio.microsoft.com/vs/community/

## Setup

1. Click the "Use this template" button on GitHub.
2. Clone your newly created repository:
   ```
   git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
   cd YOUR_REPOSITORY_NAME
   ```
3. Install dependencies:
   ```
   npm i
   ```

## Useful commands

### Start dev server

```
npm run tauri dev
```

### Build executable

```
npm run tauri build
```

### Linux AppImage: white screen / EGL_BAD_PARAMETER

If the AppImage shows a white window and the terminal prints `Could not create default EGL display: EGL_BAD_PARAMETER`, the app tries to work around this automatically when run as an AppImage. If it still fails, run with:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./YourApp.AppImage
```

(or `WEBKIT_DISABLE_COMPOSITING_MODE=1` as an alternative). This is a known WebKitGTK issue on some Linux setups (e.g. NVIDIA, Wayland).

### Windows: Defender / SmartScreen warnings

Unsigned Windows builds are often flagged by Defender or SmartScreen (“unknown publisher”, “Windows protected your PC”). To avoid that:

1. **Code signing (recommended)**  
   Sign the app with a code signing certificate (OV or EV from a trusted CA). In `src-tauri/tauri.conf.json`, under `bundle.windows`, set:
   - `certificateThumbprint`: the thumbprint of your installed .pfx (from `certmgr.msc` → your certificate → Details → Thumbprint).
   - Keep `digestAlgorithm` (e.g. `sha256`) and `timestampUrl` as-is, or use the URL provided by your CA.

   Full steps: [Tauri – Windows code signing](https://tauri.app/distribute/sign/windows).

2. **Report a false positive**  
   If you’re sure the build is safe, submit it for analysis: [Microsoft Security Intelligence](https://www.microsoft.com/en-us/wdsi/filesubmission).

3. **MSI installer**  
   Building on Windows with only the MSI target (`npm run tauri build -- --bundles msi`) can sometimes reduce false positives compared to the NSIS .exe installer. MSI can only be built on Windows.

### Add shadcn-svelte component

```
npx shadcn-svelte@next add <component>
```

Replace `<component>` with the name of the component you want to add (e.g., button, card, dialog). You can find the full list of available components at https://next.shadcn-svelte.com/docs/components.

## Other links

### Svelte 5

https://svelte.dev/docs

### Tauri 2

https://tauri.app/start/

### shadcn-svelte

https://next.shadcn-svelte.com/

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
