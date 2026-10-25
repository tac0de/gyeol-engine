# __PROJECT_ID__

A standalone Gyeol Engine **web 2D** game study. No portal, React, account, database, personal kernel, or generation service is needed. Node 24.2+ is required for development.

```sh
npm install
npm run dev
```

Open the printed localhost URL. Use the menu to start, arrow keys or adjacent-tile clicks to move, wake three amber nodes, and reach the green terminal. Results offer a new run, export, or replay. Escape/Pause opens a native modal; Resume returns focus to the board. Menu return pauses the game. There is no time limit.

## Agent edit and verification loop

- `src/rules.ts`: deterministic game state/actions/validation and example route planner.
- `src/main.ts`: screen flow, DOM/Canvas presentation, and input. Reuse the engine's `mountScreens`/`mountDialog` public UI module; scope entry listeners with the supplied signal. Rules stay independent of presentation.
- `src/style.css`: this game's theme. Its CSS imports the engine's opt-in structural UI classes. Styles are linked as an external stylesheet so development and built output both preserve the script/style CSP without inline-style exceptions.
- `index.html`: semantic native controls, labelled screens/dialog, and Canvas logical dimensions.
- `vendor/gyeol-engine.tgz`: the installed engine version used at generation. Commit it; deliberately replace/reinstall/check when upgrading.
- `AGENTS.md`: portable file ownership and verification instructions for your coding agent.

```sh
npm run check
npm run inspect
npm run scenario -- --out /absolute/new-run.json
npm run replay -- /absolute/new-run.json
npx playwright install chromium
npm run check:browser -- --evidence-dir /absolute/private-evidence
```

Browser checks exercise visible controls, actual headless keyboard/pointer input, menu/play/results, modal/focus/independent pause, repeated navigation, export/import/replay, and responsive layout. A separate browser fixture checks the shipped screen/dialog lifecycle APIs. Review screenshots directly; checks do not establish fun, art quality, or all-browser support. The scenario uses ordinary engine commands, not a second simulation. A replay is not a persistent player save or source-authenticated reproduction.

## Optional desktop trial

Web installation and checks do not install Electron. Request the extra development dependencies explicitly:

```sh
npm run desktop:setup
npm run desktop:package
npm run desktop:smoke -- --report /absolute/new-desktop-report.json
```

Setup pins/adds Electron and packager to this project's development dependencies and lockfile. Packaging produces a host-native unsigned app under `desktop-out/`. It bundles local files, exposes no Node/preload bridge, enables sandbox/context isolation, denies permissions/remote requests/navigation/new windows, and does not require a server while playing. The smoke launches a hidden packaged window, uses visible menu/result controls, verifies play/replay/isolation, saves report/capture, and exits.

The local protected macOS shell may reject nested Electron sandbox initialization. Keep protections enabled and use the engine repository's manual isolated Mac workflow for compatibility checks. Only the tested host is covered. Signing/notarization, Steam, installers, auto-updates, other OS certification, player saves, and a complete asset pipeline are separate work.

MIT; retain engine and dependency licenses. Commit `package-lock.json` after installation to pin your project's tools. See the engine's `docs/ui.md` and `docs/roadmap.md` for the current UI scope and remaining public-beta work.
