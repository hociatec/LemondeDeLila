# Verification of point 163

The game generator now supports `jsonOnly: true` / `--json-only`. Such a game
contains only `manifest.json`, `game.json`, and `rules.md`; registry generation
discovers it and loads the generic minimal engine profile. No game-specific
TypeScript file is required for the existing `empty` mechanic profile.

Verification: the JSON-only create-game and registry tests, plus TypeScript
compilation.
