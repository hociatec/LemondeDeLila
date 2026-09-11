# Verification of point 17

The canonical state contract now declares `GameState`, `TurnState`, and
`PlayerState`, which describe runtime snapshots rather than ORM entities. The
legacy `*Entity` names remain deprecated aliases solely for incremental caller
migration and do not create duplicate shapes.

Verification: TypeScript build and the game runtime contract tests.
