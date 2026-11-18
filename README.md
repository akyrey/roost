# Roost

The kit shared by [Dunlin](https://github.com/akyrey/dunlin) (a database client) and Whimbrel (an
HTTP client): two small Tauri 2 desktop apps with a Rust backend and a React frontend.

| Package                             | What it is                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@roost/ui`                         | Base components (Button, Modal, ConfirmDialog, ContextMenu, Toaster, Skeleton, PanelBoundary, SidebarResizer), clipboard, theme resolution, the light palette, editor settings |
| `@roost/shortcuts`                  | A keyboard shortcut registry with platform labels and matching, and the shortcuts dialog                                                                                       |
| `@roost/palette`                    | The command palette and its fuzzy matcher                                                                                                                                      |
| `@roost/editor`                     | CodeMirror editors with the shared theme; heavy, load it on first use                                                                                                          |
| `@roost/grid`                       | A row- and column-virtualised grid, generic over values and columns (`CellAdapter`)                                                                                            |
| `@roost/updates`                    | In-app update state and prompt over the app's updater IPC                                                                                                                      |
| `roost-shell` (crate)               | Signed in-app updates (Tauri updater) and JSON log files                                                                                                                       |
| `roost-keychain` (crate)            | Secrets in the OS keychain (macOS keychain, Secret Service on Linux)                                                                                                           |
| `.github/workflows/release-app.yml` | Reusable release workflow: signed macOS app and dmg, Linux deb/rpm/AppImage, updater manifest                                                                                  |

Nothing is published to npm or crates.io. Apps depend on a tag:

```toml
# Cargo.toml
roost-shell = { git = "https://github.com/akyrey/roost", tag = "v0.1.0" }
```

```jsonc
// package.json
"@roost/ui": "github:akyrey/roost#v0.1.0&path:/packages/ui"
```

Frontend packages ship TypeScript source; the app's Vite compiles them. React, Zustand,
CodeMirror and TanStack Virtual are peer dependencies. Tailwind classes are used as in the apps,
so an app adds `@source "../node_modules/@roost";` to its CSS for Tailwind to see them.

```yaml
# .github/workflows/release.yml in an app
jobs:
  release:
    uses: akyrey/roost/.github/workflows/release-app.yml@v0.1.0
    with: { app-dir: apps/desktop, product-name: Dunlin, binary-name: dunlin }
    secrets: { TAURI_SIGNING_PRIVATE_KEY: "${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}" } # and the rest
```

## Rules

- No app code here. Something only one app uses stays in that app.
- A package imports others as `@roost/<package>`, never by path (ESLint enforces it).
- Semver tags. While 0.x, a minor bump may break the apps; each app bumps on its own schedule.
- Tests, typecheck, lint and 80% coverage per crate and for the frontend, as in the apps.

## Working on an app and Roost together

In the app, `scripts/link-roost.sh ../roost` points Cargo (a git-ignored `.cargo/config.toml`
`[patch]`) and pnpm (`link:` overrides) at a local checkout; `scripts/unlink-roost.sh` undoes it.
CI always builds against the tag.

## History

The files were extracted from Dunlin with their history (`git filter-branch`). Dunlin's
decision D-039 and Whimbrel's D-H09 record why.
