# Standalone PC 2D authoring

Node 24.2+; current engine package version 0.5.0. From a built checkout:

```sh
npm ci
npm run build
node dist/tools/cli.js create /absolute/new-signal-garden
cd /absolute/new-signal-garden
npm install
npm run dev
```

From an engine tarball, `npm exec --package=/absolute/engine.tgz -- gyeol create /absolute/new-signal-garden` exposes the same installed CLI. No npm registry release is assumed. Creation does not install dependencies or start anything. The parent must exist, the destination must be new, its basename must be a lowercase project id, and symlink paths are rejected. Existing files/directories are never adopted. `--title TITLE` sets a safely escaped display title.

The new project contains its own engine tarball, source, deterministic circuit puzzle, real browser input, tests, CLI inspect/scenario/replay commands, UI JSON export/import/playback, and an optional host-native Electron packaging command. The generated README lists exact commands. Core/browser imports come only from the installed public engine package; there is no consumer checkout path, Next portal, React wrapper, account, database, or kernel dependency. Vite/TypeScript/Playwright/Electron are development dependencies of the new project, not runtime dependencies of the engine.

`src/rules.ts` owns the example's game rules. `src/main.ts` delegates session/input/lifecycle to existing engine APIs. The circuit's Canvas geometry is the actual puzzle UI, not a production character-art pipeline. The old `createGame` portal API remains compatible for existing consumers. Independent games use `createStandaloneProject` from `/tools/standalone`, which loads no Vite/React peer just to create a directory.

## Verification

`npm run check` in this repository verifies engine regressions and standalone generator boundaries, plus offline runtime-only installation and game/replay tests. Full acceptance is explicit because it installs a fresh project toolchain and packages a host executable:

```sh
node tests/standalone.integration.ts --evidence-dir /absolute/new-private-directory
```

This packs the engine, installs only that tarball into an unrelated bootstrap, invokes its actual `gyeol` bin, installs the generated project's tools, checks/builds/plays it headlessly, exports/imports/replays a trail, and packages/launches a hidden host-native app. Logs, recordings, reports, screenshots, and executable output stay under the supplied external evidence directory. No user browser profile, headed browser, host input, sandbox-disable flag, or public upload is involved in this command.

A successful host-native package smoke establishes bundled local loading, actual example actions/replay, and the checked renderer isolation settings. It does not establish signing, notarization, Steam integration, other OS support, human fun, or long-term saves. Replay identifies game/rule version but is not a source-bound authenticated reproduction; the existing reproduction tools remain available for that separate use.

On the 2026-10-25 protected macOS arm64 development host, real headless browser play/export/import/replay passed and the Electron 45.0.0 `.app` package was produced. Packaged execution was blocked before game loading by `sandbox initialization failed: Operation not permitted`. The OS guard and Electron sandbox were preserved; packaged gameplay remains unverified on that host. Integration keeps this failure nonzero and records the partial browser/package evidence instead of treating it as a successful smoke. Run the same `desktop:smoke` command in a compatible normal development environment to resolve that remaining check.

For that known incompatible host, explicitly append `--package-only` to the integration command to check generation, browser play, replay, packaging, and archive contents without retrying the blocked launch. Its result says `desktopExecution: not_run`; it is not the full desktop acceptance check.

## Packaging decisions

Electron is a small-scope feasibility host here, not a mandatory engine dependency or a final choice for every game. The sample keeps sandbox/context isolation enabled, exposes no preload/Node bridge, loads only bundled files, blocks other file paths and remote requests, and denies permissions/navigation/new windows. Generated app names are sanitized separately from arbitrary display titles. Final distribution requires current dependencies and platform-specific release work.

References: [Electron application packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Vite build](https://vite.dev/guide/build), [Playwright browser automation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).
