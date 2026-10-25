# This Gyeol web game

- This project is independent. Use the installed public engine package, not a sibling engine checkout or a private kernel.
- `src/rules.ts` owns deterministic rules/state/actions; do not read wall time, DOM, or Math.random there. Bump the rule version when recordings become incompatible.
- `src/main.ts` owns presentation and navigation. Reuse `mountScreens`/`mountDialog`; scope entry listeners with their AbortSignal and clean up other resources. Keep pause reasons independent.
- `src/style.css` owns the theme; engine UI CSS is opt-in structure. Use semantic HTML, visible keyboard focus, wrapping layouts, and logical Canvas coordinates.
- Run `npm run check`. Use `inspect`, `scenario -- --out ABS_NEW_JSON`, and `replay -- FILE` to inspect and reproduce. Run `check:browser -- --evidence-dir ABS_PRIVATE_DIR` for actual headless input and screenshots; inspect screenshots directly.
- Never use hidden inactive-screen controls as user actions. Use the visible menu, result buttons, native pause dialog, and file input associated with the visible Import trail label.
- Web development is the default. Electron is absent until explicitly requested with `npm run desktop:setup`; PC packaging is optional.
- Preserve user content, licenses, credentials, and unrelated changes. Do not publish, deploy, install optional tools, or call paid generation services without task authorization.

- `src/progress.ts` owns the game save schema/migrations. Use checkpoint + versioned save APIs; do not equate replay history with player saves. Never silently overwrite unread, corrupt, future, or conflicting progress. Keep auto-save off while showing an imported/replayed trail. Run `check:persistence -- --evidence-dir ABS_PRIVATE_DIR` for restart/migration/recovery/failure checks.
