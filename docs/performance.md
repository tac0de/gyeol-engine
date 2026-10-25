# Complete-game runtime work (0.8)

The project keeps Gyeol rather than adopting Phaser. This release addresses observed lifecycle and repeated-work boundaries. It does not establish superiority over Phaser or certify a finished game's performance, art, balance, or production readiness.

## State-driven rendering

`mountBrowserGame` accepts `renderMode: 'on-change'`. It skips inspect/changed/render on RAF callbacks that produce no simulation tick. State-changing commands, inputs, initial state, restore, and resize still render. The default remains `every-frame` for consumers with wall-clock presentation or interpolation.

A controlled 241-callback 120Hz trace produced 241 draws in the old/default path and 119 in on-change mode, with equal state, tick, RNG and recording. This is avoided work on that trace, not a hardware FPS/latency/GPU benchmark. The fixed-tick clock and catch-up/drop behavior are unchanged. Do not opt in a renderer that needs intermediate-frame animation without putting that visual state into the simulation or choosing every-frame.

## Scoped image work

`createAssetScope(gameId, {concurrency: 4})` caches promises/results by canonical same-origin game URL. Duplicate pending and ready calls share a resource. Failed loads are evicted for explicit retry. The shared queue bounds in-flight work (1..32), not total retained decoded bytes. Dispose the scope when the game/scene leaves; it rejects queued work, aborts requests, closes late ImageBitmaps and returns a barrier for owned pending work.

- `loadImage(path)` returns an owned ImageBitmap for Canvas drawing.
- `loadElement(path)` warms a detached HTMLImageElement for DOM/CSS consumers, avoiding an extra ImageBitmap copy. Scope disposal clears its source.
- The two resource types have separate caches. Query strings participate in identity. Same-game URL boundaries also reject encoded path separators.
- `inspect()` reports active/queued/cached counts for diagnostics.

Use a new scope for retry after disposal. Do not close shared bitmaps behind other aliases. This is neither a global cache nor an unlimited world's streaming/eviction system.

Actual browser tests verify one request for aliases, failure/retry, a peak of two requests with concurrency two, queued cancellation, and native bitmap/DOM-source release. They do not claim that lower concurrency always improves total loading time.

## Presentation follows actual completion

```ts
import {settleAnimations} from '@thedivineparadox/game-engine/runtime/browser/animations';
const abort = new AbortController();
const outcome = await settleAnimations(effectRoot, {signal: abort.signal, timeoutMs: 5000});
// outcome.status: finished | cancelled | aborted | timeout
```

The helper observes the current finite animations in a DOM subtree (CSS animations, transitions and WAAPI). It never cancels unrelated animations. Infinite effects are counted as ignored. A timeout/abort/cancellation is not reported as finished. An empty/reduced-motion batch completes without an artificial delay. Mount the full batch before observing it; animations added later require another observation. Abort the observer on component cleanup. Animation timing remains native, not part of deterministic rules/replay.

This addresses a concrete consumer mismatch: Samgukpa's fixed 600ms cleanup can remove effects whose declared CSS duration is 650..760ms. The consumer integration must wait on the actual mounted batch and cancel observation on pause/unmount rather than copying durations into JavaScript.

## Repeatable CPU measurements and replay

```sh
gyeol profile /absolute/game-project rain-dodge --scenario /private/scenario.json --samples 10
```

The scenario is `{ "seed": 1, "commands": [{"type":"start"},{"type":"advance","ticks":1800}] }`. This explicitly loads the selected local project's rule module. It does not install packages, start servers, or publish anything. Tooling peers used by that project must be installed already.

The command warms two fresh sessions, samples 3..100 runs, and reports min/median/p95/max CPU wall time for creation, commands, and detached inspection. Every sample's final snapshot is compared, and its actual exported recording is independently replayed outside the timed region. Drift or invalid commands fail the command. Scenario/snapshot hashes, rule id/version, seed, command count, requested ticks, sample count and replay count accompany results. Work is bounded to one million requested tick/command units across warmup/samples; input is bounded JSON.

These are same-environment Node command/copy/validation costs. They are not browser render time, heap allocation, full-game FPS, or an apples-to-apples Phaser comparison. Preserve the scenario and rule/source revision with measurements; use the existing source-bound reproduction tools when source identity must be authenticated.

## Checks

- `npm run check`: core, lifecycle, resource queue, controlled host trace, actual CLI fixtures and existing save/replay/package regression.
- `node tests/browser-features.integration.ts --evidence-dir /absolute/private/path`: compiled public entries in headless Chromium with native images and CSS completion/cancel/abort/timeout/reduced-motion checks.
- Existing standalone acceptance remains a separate web play/save/replay flow. Desktop packaging stays optional.

Primary API references: [getAnimations](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAnimations), [Animation.finished](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished).
