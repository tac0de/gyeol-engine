# __PROJECT_ID__

A standalone Gyeol Engine 2D study. No portal, React, account, database, asset-generation service, or kernel CLI is required to play, test, record, replay, or package it. Node 24.2+ is required for development; the packaged desktop game includes its runtime.

```sh
npm install
npm run dev
```

Open the printed localhost URL. Start the circuit, use arrow keys or click adjacent tiles, light three amber nodes, and reach the green terminal. The example uses precise Canvas circuit/decision symbols, not placeholder character art. There is no time limit. Restart, export a trail, import it, or replay it in the UI.

## Agent edit and verification loop

- `src/rules.ts`: deterministic game state, actions, validation, and the example route planner.
- `src/main.ts`: presentation and input adapter using the engine's browser host.
- `src/style.css`: responsive PC layout. Rendering never owns game rules.
- `tests/rules.test.ts`: win, collision, pause, restart, incompatible record, and exact snapshot replay.
- `vendor/gyeol-engine.tgz`: the engine version used when this project was generated. Keep it in version control. To upgrade, deliberately replace this file, reinstall, and rerun checks.

```sh
npm run check
npm run inspect
npm run scenario -- --out /absolute/new-run.json
npm run replay -- /absolute/new-run.json
npx playwright install chromium
npm run check:browser -- --evidence-dir /absolute/private-evidence
```

The scenario dispatches ordinary engine commands, not a second simulation. UI exports and CLI recordings share one format. Replay validates rule id/version, action/state shape, and bounded JSON; changing the rules may require a version bump. A recording is a replay, not a persistent player save or a source-authenticated reproduction bundle. Browser checks use actual headless keyboard/pointer input, export/import, exact replay, and saved screenshots. Review the screenshots separately; test success does not establish fun or art quality.

## Small desktop packaging trial

```sh
npm run desktop:package
npm run desktop:smoke -- --report /absolute/new-desktop-report.json
```

`desktop-out/` contains a host-native Electron package and a staging directory. The build bundles local runtime/assets, with Node integration disabled, context isolation and sandbox enabled, permissions denied, and remote requests/new windows/navigation blocked. The smoke check launches the packaged executable with its window hidden, completes the circuit, replays it, checks isolation, writes a report/screenshot, then exits. Normal launch shows the game window.

Only your current host OS/architecture is targeted. This is an unsigned packaging experiment; Steam, installers, signing/notarization, auto-updates, and Windows/Linux/macOS certification are separate work. Keep Electron current before releasing. An initial dependency install downloads development tools and the Electron binary; playing the packaged game does not require a server or network.

MIT. The engine license remains in the vendor package and packaged app. Dependency licenses retain their own terms. Commit `package-lock.json` after installation to pin your project toolchain.
