# Documentation consolidation map

This map records the current documentation ownership decision. It is a
maintenance aid, not part of the published navigation.

| Existing page(s) | Action | Authoritative destination |
| --- | --- | --- |
| `astronomy-coordinate-contract.md` + coordinate-pipeline sections in `spice-backend.md` | Shorten the contract to observable coordinate/motion/time guarantees; replace implementation restatement with a link | Astronomy coordinate contract |
| coordinate caching and Type-21 sections in `astronomy-coordinate-contract.md` | Remove from contract; retain cache/artifact behavior with coverage/acquisition details | Ephemerides and coverage |
| `spice-backend.md` | Keep as implementation reference; link to the coordinate contract for guarantees | SPICE calculation backend |
| `ephemeris-manager.md` | Keep and retitle around reader task | Ephemerides and coverage |
| `ephemeris-validation.md` | Keep and retitle around evidence | Validation and performance |
| `workspace-yaml.md` + `rust-workspace-contract.md` | Merge lifecycle, loader, resolution, and catalog propagation into the portable workspace contract; redirect old URL | Workspace YAML contract |
| `configuration-reference.md` | Shorten to serialized setting vocabulary and presentation boundary; link to workspace contract for precedence | Configuration reference |
| `architecture.md` + `backend-structure.md` | Merge persistence/result lifecycle and Rust/Python ownership into architecture; redirect old URL | Architecture |
| `rust-code-structure.md` | Keep as the source-module map, without duplicating runtime architecture | Rust code structure |
| `frontend-workflow-baseline.md`, `frontend-react.md`, `frontend-svelte.md` | Keep separate: shared workflow contract versus shell-specific reference | Frontend workflow baseline |
| `workspace-yaml.md`, `transit-series-contract.md`, `tauri-command-contracts.md` transit sections | Put persisted intent in workspace YAML, behavior/response guarantees in the transit contract, and transport names only in command reference | Transit series contract for transit behavior |
| `development-driver.md` + `ci-todo.md` | Keep as plans, explicitly non-normative | Development roadmap / CI todo |
| `discussion-summary.md` | Archive and redirect old URL | `developer/archive/discussion-summary/` |
| Manual and Guides pages | Keep task/manual content separate from interactive walkthroughs | Manual for behavior; Guides link back rather than duplicate |

The developer index is the discovery layer: it names one answer for each
reader question and labels contracts, implementation references, plans, and
history so they are not confused.
