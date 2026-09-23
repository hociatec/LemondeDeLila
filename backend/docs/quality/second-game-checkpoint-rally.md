# Second-game attempt: checkpoint rally

Audit items: 5 and 6. Pack: `race-directional-hazards`. Initial outcome: **failed**;
after separating victory: **the tested rally now runs**. Classification remains
`game-specific`. This is one documented attempt, not
coverage of all 38 packs and not proof that every possible second game fails.

## Different rules

The candidate is a circular rally with six positions. Crossing the last position
does not end the match. Landing on position zero earns a checkpoint; three
checkpoints win. This changes board topology, scoring and the victory condition,
rather than just names or numeric parameters of the original finish-line race.

Executable source: `src/game/testing/fixtures/second-game-attempts/checkpoint-rally.json`.
Regression suite: `src/game/testing/architecture-tests/game/directional-hazard-reuse.spec.ts`.
The suite first compiles the authored candidate through the public JSON compiler,
without replacing or mocking the extension implementation.

## Initial obstruction (before victory separation)

The original contract rejected the candidate at `game.json.victory`: the extension
and `by-directional-hazard-race` victory are mandatory together. Selecting that
victory as a diagnostic fallback prematurely finishes the rally at position five,
before any checkpoint has been earned. Changing the reason string cannot change
this behavior.

A control removes the extension and substitutes primitive movement, retaining
the six-position circuit, checkpoint action and resource objective. Fourteen
one-space moves from position four complete three checkpoints, with no earlier
finish. The full command journal replays to the same state.

## Decomposition performed

The attempt also exposed three duplicated bounds calculations inside the pack:
individual movement, collective movement, and collective random movement forced
clamping independently of the track component. They now use the existing
`movement.preview` capability and then `moveTo`. Keeping `moveTo` preserves the
effective movement distance in events for the original clamped board.

Tests exercise clamp, wrap, bounce and exact arrival, backward wrap, collective
random movement and replay. No new SDK capability or public export was needed.
The movement change alone did not remove the victory obstruction.

## Victory separation

The fixture now explicitly selects `victoryMode: "external"`. Movement and card
resolution stay in the pack, while the ordinary JSON resource objective decides
the winner. Both automatic arrival victory and the historical explicit
`race-hazard.mark-winner` effect are disabled in this mode. The test deliberately
invokes that effect on each move and verifies no finish before the third point.
The pack-based and primitive controls both complete fourteen moves and replay.

Omitting `victoryMode` retains historical arrival behavior; explicit `arrival`
does the same. Contradictory mode/objective pairs are rejected at
`game.json.victory.kind`. The generic extension protocol allows this separation
only when its definition declares `victoryRequired: false`; other packs keep
their coupled contract. Selecting any extension victory still requires the
corresponding extension to be present.

This fixture demonstrates one composition after a targeted contract change. It
does not establish that every hazard card, bot or multiplayer interaction suits
the new game, nor certify the entire pack as reusable. The remaining 37 packs
still need their own second-game attempts, and broader decomposition remains open.

No catalogue game, content version or published extension classification changes.
