# Versioned browser progress (0.7)

This layer saves selected JSON progress, not the whole command history. The game owns the save schema, validation, migrations, timing, recovery choices, and business rules. It is separate from cloud/account storage and from source-authenticated reproduction bundles.

## A durable session boundary

```ts
import {createSession, restoreSession, isCheckpoint} from '@thedivineparadox/game-engine/runtime';
const checkpoint = session.exportCheckpoint();
const continued = restoreSession(rules, checkpoint);
```

A format-1 checkpoint contains game id, rule version, seed, validated state, tick, current RNG state, and whether the run started. It contains no historical commands or browser/UI pause reasons. Restore checks the complete shape and current rules before creating a new session; no `rules.create()` or old history replay is needed. It is a detached JSON copy, not a score-authentication mechanism. Rule-version changes require an explicit game migration.

A continued session exports **format-2 recordings** with the checkpoint as their origin and only new commands. `replay()` and the source-bound reproduction tools support this origin. Format-1 recordings still work. Restart opens a normal format-1 recording epoch. Old engine versions that only understand format 1 cannot replay format 2; this is a forward-compatibility limit, not a silently truncated replay.

The browser host exposes `exportCheckpoint()` and `restoreCheckpoint(value)`. A candidate is validated before replacing the live session, input state is cleared, and the host preserves currently active pause reasons and reapplies actual document visibility. Application navigation releases only its own reasons. The generated game demonstrates this path.

## A versioned slot

```ts
import {createBrowserSaveSlot} from '@thedivineparadox/game-engine/runtime/browser/save';
const slot = createBrowserSaveSlot({
  key: 'my-game:progress', gameId: 'my-game', version: 2,
  validate: isCurrentProgress,
  migrations: {1: old => migrateV1ToV2(old)},
});
const loaded = slot.load(); // read-only; migrations happen on detached copies in memory
if (loaded.status === 'ready') {
  // Apply loaded.value only after the player chooses Continue.
  // slot.save(currentProgress) explicitly commits the upgraded representation.
}
```

`createSaveSlot` from `/runtime` accepts the same options and a lazy `storage: () => StoragePort` instead of a browser dependency. `StoragePort` needs synchronous `getItem`, `setItem`, and `removeItem`. Importing/creating the browser adapter does not touch localStorage; denied getters and operations return structured results.

One key stores a format/game-id envelope with a current record and a previous-good backup. Records carry a positive data version, sequence, payload, and non-cryptographic checksum for accidental corruption. A successful save replaces that one key in one `setItem`, carrying forward the previous validated record as backup. No multi-key partial-commit protocol is assumed. A custom StoragePort must preserve the standard atomic replacement-on-error behavior.

Default envelope limit is 512,000 UTF-8 bytes including backup; it can be set from 128 to 1,000,000 bytes. JSON depth/node/character limits also apply. This is deliberately for bounded progress; use another storage design for large worlds, media, long histories, or transactional shared data.

### Results and recovery

- `load(): empty | ready | recoverable | error`. `ready/recoverable` include a detached value, current/source versions, sequence, and migration flag. Load **never writes**, including migrations and fallback selection.
- `save(value)`: explicit save after load. Returns `saved` or `error`. Validation, future versions, unavailable migrations, size, and unconfirmed backup recovery block a destructive overwrite.
- `recoverBackup()`: explicitly promotes the checked backup after a `recoverable` load. A failed promotion leaves the original bytes untouched. No data is reconstructed when both generations or the envelope are unreadable.
- `reset()`: destructive removal only when the application/player explicitly chooses it. The sample has a labelled confirmation dialog. Reset can itself fail; it is not reported as successful unless removal succeeds.
- `exportRaw()`: the last observed stored bytes for download/diagnostics. It is not an automatic recovery or import API.

Error reasons include `unavailable`, `quota_exceeded`, `write_failed`, `corrupt`, `invalid_data`, `future_version`, `migration_missing`, `migration_failed`, `too_large`, `invalid_value`, `conflict`, `not_loaded`, and `recovery_required`. On write failure, the current in-memory run can continue; the old slot/backup remain unchanged. Retry is explicit. A save from a newer version stays protected even if an older backup exists.

Each instance compares the currently stored raw value to its last load/commit before saving or resetting. This catches observed stale-tab changes. **It is not an atomic cross-tab compare-and-swap or a locking guarantee**: localStorage has no such transaction. Use a single writer per slot; concurrent/large applications need a transactional adapter such as a separately designed IndexedDB implementation. The sample asks the player to choose stored progress after access returns rather than silently overwriting previously unread data.

## Example behavior and checks

`src/progress.ts` owns schema 2 (`{checkpoint}`) and the explicit schema-1 migration (`{run}` → `{checkpoint}`). The example saves at meaningful move boundaries and offers Save/Retry/Restore backup/Download stored data/confirmed reset. Page hide/visibility hooks are best-effort supplements, not the only durability mechanism. Time since the last committed boundary may be lost on a crash. Replaying/importing a trail does not replace player progress.

```sh
npm run check:persistence -- --evidence-dir /absolute/private-evidence
```

The test uses its own temporary persistent Chromium profile, actually closes the browser process and relaunches it, continues and wins, then verifies the format-2 exported trail. It separately seeds valid historical/future and corrupt fixtures, injects target-key quota/access failures, checks preservation, performs visible recovery/reset/retry actions, and captures results. These are controlled fault injections, not a claim that the host disk was full. The profile is removed afterward. No user profile or browser security setting is changed.

Local storage belongs to an origin (scheme/host/port) and can be cleared or evicted by the browser. Private mode has different lifetime rules; `file:` storage is not portable. This release does not promise cloud sync, encryption, multi-tab serialization, hardware power-loss durability, or guaranteed storage retention.

References: [WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), [localStorage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [quota/error behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
