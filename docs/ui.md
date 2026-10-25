# Web screens and UI (0.6)

The engine provides small, opt-in DOM presentation tools. They do not own game rules, player saves, animation timelines, asset loading policy, or a framework-specific component tree. They work with the existing Canvas host and with other browser presentations.

```ts
import {mountScreens, mountDialog} from '@thedivineparadox/game-engine/runtime/browser/ui';
import '@thedivineparadox/game-engine/runtime/browser/ui.css';

const flow = mountScreens(root, {
  initial: 'menu',
  screens: {
    menu: {element: menu, focus: startButton, enter: ({signal}) => {
      startButton.addEventListener('click', () => flow.show('play'), {signal});
    }},
    play: {element: play, focus: canvas, enter: ({signal, from, to}) => {
      host.command({type: 'pause', reason: 'screen', paused: false});
      // Listeners can use signal. Return cleanup for other resources.
      return () => host.command({type: 'pause', reason: 'screen', paused: true});
    }},
  },
});
```

Screens must be distinct, non-nested descendants of `root`. Exactly one screen is visible and interactive; inactive screens use `hidden` and `inert`. Each entry gets a fresh `AbortSignal`; leaving aborts that signal and calls the returned cleanup once. Showing the current screen is a no-op. Transitions are synchronous: reentrant navigation is rejected, and asynchronous loading/cancellation stays with the game. If entry/cleanup fails, the flow fails closed with all screens hidden and `current() === null`; callers may catch the error and choose a recovery screen. It never silently resumes an old game.

Entry focuses the supplied element or the first basic focusable control. Use actual native buttons, labels, inputs, and headings. The helper does not turn arbitrary divs into accessible controls, implement menu arrow navigation, or announce every screen automatically. `dispose()` is idempotent, aborts the active scope, restores the original hidden/inert/tabindex state, and restores the previously focused connected element when possible. It does not dispose the game host itself.

```ts
const modal = mountDialog(pauseDialog, {
  focus: resumeButton,
  returnFocus: canvas,
  changed: open => host.command({type: 'pause', reason: 'ui-dialog', paused: open}),
});
pauseButton.addEventListener('click', () => modal.open());
resumeButton.addEventListener('click', () => modal.close());
// modal.dispose(); flow.dispose(); host.dispose(); when the owning UI is removed.
```

Use a connected, initially closed native `<dialog aria-labelledby="...">`. Native modal behavior contains focus and makes other content inert. Escape closes the helper's modal; open/close notifications happen once per lifecycle, including close/reopen races. Focus returns to `returnFocus` or the previously focused connected, visible element. Buttons and other app-owned listeners still need their own signal/cleanup. Do not manipulate `dialog.open` directly; use the helper's methods or native `close()`.

The generated example uses independent `screen`, `ui-dialog`, `replay`, `focus`, and `hidden` pause reasons. Closing the modal releases only its own reason. Presentation state does not enter `rules.ts`, and replay remains the same core command format. The sample demonstrates menu → play → results, pause/resume, menu return, restart, export/import, and replay through actionable visible controls.

## Structural CSS

- `gyeol-stack`, `gyeol-row`: vertical and wrapping horizontal groups.
- `gyeol-grid`: responsive columns with `--gyeol-column` and `--gyeol-gap`.
- `gyeol-panel`: responsive padding and long-text wrapping.
- `gyeol-action`: minimum 44px target and visible keyboard focus.
- `gyeol-dialog`: bounded, scrollable modal and backdrop.
- `data-gyeol-screen`: preserves hidden screens even when display classes are applied.

These classes are opt-in structure, not a visual theme or Canvas widget renderer. The game owns colors, type, art, HUD, layout composition, text content, and responsive breakpoints. Canvas hit coordinates remain the browser host's logical viewport. This release does not include gamepad navigation, input remapping, virtual lists, nine-slice rendering, or a general layout editor.

## Checks

The packed standalone browser acceptance covers real keyboard/pointer play, menu/result transitions, modal Tab/Escape and focus return, independent environmental pause, reentry, JSON export/import/replay, and 1120/680/320px layouts. A separate real-browser fixture imports the shipped public module and checks abort/cleanup, no duplicate listeners, disposal restoration, nested-screen rejection, failed entry, and modal close/reopen races. Screenshots require direct review; arithmetic and test pass counts are not art approval.

References: [native modal behavior](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal), [scene lifecycle comparison](https://docs.phaser.io/phaser/concepts/scenes). Gyeol deliberately supplies a smaller DOM layer rather than recreating Phaser's scene renderer.
