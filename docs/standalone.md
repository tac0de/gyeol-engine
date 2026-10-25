# Standalone web 2D authoring

Gyeol Engine 0.7.0 targets agent-assisted web 2D game development. Desktop packaging is optional. Node 24.2+ is needed for development.

```sh
npm ci
npm run build
node dist/tools/cli.js create /absolute/new-signal-garden
cd /absolute/new-signal-garden
npm install
npm run dev
```

From an engine tarball, `npm exec --package=/absolute/engine.tgz -- gyeol create /absolute/new-signal-garden` exposes the same installed CLI. No npm registry release is assumed. Creation does not install tools or start a server. The parent must exist, the destination must be new, its basename must be a lowercase project id, and symlink paths are rejected. `--title TITLE` sets a safely escaped display title.

The project contains its own engine tarball, rules/presentation source, menu/play/results and pause dialog, UI JSON export/import/replay, tests, and CLI inspect/scenario/replay. There is no portal, React, account, database, personal kernel, or proprietary generation requirement. Web development dependencies include Vite, TypeScript, and Playwright; Electron/packager are absent from a normal install. The old portal `createGame` API remains available for existing consumers. See [UI API](ui.md) and [public beta scope](roadmap.md).

The generated game also has schema-versioned local progress, Continue, explicit backup restoration, confirmed reset, and failed-save retry. See [save/checkpoint contracts](saves.md). Saved game data is separate from replay files and cloud/account storage.

## Verify the web loop

```sh
npm run check
node tests/standalone.integration.ts --evidence-dir /absolute/private-evidence
```

Repository checks verify engine regressions and generator boundaries. Full web integration packs the engine, installs its actual `gyeol` bin into an unrelated bootstrap, creates a fresh project, verifies Electron is absent, builds/tests it, and exercises the visible menu/play/results/pause flow, focus, lifecycle, keyboard/pointer, export/import/replay and responsive layout in headless Chromium. Persistence acceptance additionally closes/relaunches an owned persistent browser profile and checks migration, corruption, quota/denial, and replay after resuming. Reports/screenshots/logs stay outside source. Inspect screenshots; passing tests do not establish fun or art quality. Other browsers/devices remain separate verification until the support matrix is established.

## Optional desktop feasibility host

In a generated game:

```sh
npm run desktop:setup
npm run desktop:package
npm run desktop:smoke -- --report /absolute/new-desktop-report.json
```

`desktop:setup` explicitly adds pinned Electron/packager development dependencies and updates that game's manifest/lockfile. It is not run by `create`, ordinary `npm install`, or web checks. It downloads the optional tools and Electron binary. Packaging targets the current host and bundles local runtime/assets; it does not sign, notarize, install, or integrate Steam.

The smoke launches a packaged app with its window hidden, completes the visible menu/game/results path, replays the route, checks sandbox/context isolation/Node non-exposure, captures a screenshot/report, and exits. It does not substitute for human UI testing or certify other platforms.

To test the optional path from this repository, append `--desktop` to integration. `--package-only` keeps the earlier explicit desktop-package-without-launch check. Default integration is web-only.

The protected local macOS shell cannot initialize nested Electron sandboxes. Do not lower the OS guard, use unconfined tools to bypass it, or disable Electron isolation. The manual **Standalone macOS smoke** workflow uses a separate standard `macos-15` arm64 VM with only this public repository checked out. No developer home, local `.local`, credentials, or user browser profile is uploaded/mounted. It is manual-only, with read-only repository permission, SHA-pinned official actions, and seven-day report/screenshot/log retention. App binaries/dependency trees are not uploaded.

`gh workflow run macos-smoke.yml --ref main` requests that optional check. A pass requires actual `desktop.status: passed`, `packaged/won/replayVerified/sandbox/contextIsolation: true`, and `nodeIntegration/nodeExposed: false`. Inspect the app screenshot and exact run SHA. This establishes execution on that VM, not compatibility with the original nested sandbox or a signed release. The 0.5.1 workflow established this compatible path; UI changes must be checked again before claiming its current behavior.

References: [Electron sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox), [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [GitHub runner isolation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job).
