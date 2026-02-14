# Backend Games Mutualization Plan

## Scope
- Target: `backend/src/game/games/**`
- Current architecture already has shared modules in `backend/src/game/modules/**` and core/engine services.
- Goal: reduce per-game specific code by moving repeated patterns into reusable engine modules.

## Current Snapshot (2026-02-13)
- Games discovered: 37
- Most games follow the same structure:
  - `setup/`
  - `actions/`
  - `bots/`
  - `presenter/`
- Large action services (highest refactor value):
  - `contes-action.service.ts` (1734 lines)
  - `sac-a-malices-action.service.ts` (1327)
  - `frousse-action.service.ts` (1303)
  - `minuit-action.service.ts` (1128)
  - `ca-actions.service.ts` (1089)
  - `a-fond-les-ballons-action.service.ts` (1068)

## Existing Shared Building Blocks
- Turn: `modules/turn`
- Cards/decks: `modules/cards`
- Board/movement: `modules/board`, `modules/movement`
- Pending: `modules/pending-action`, `modules/effects/pending-requirement.service.ts`
- Bot infra: `modules/bot`, engine scheduling in `game-engine.service.ts`
- State/phase: `modules/state`
- Victory: `modules/victory`

These are good foundations, but not yet used consistently by all games.

## Duplication Patterns To Eliminate
1. Setup flow
- "who starts", setup phase transitions, first prompt creation.

2. Pawn/family/token selection
- pending choice creation, validation, assignment, setup logs.

3. Roll + move + landing resolution
- repeated board progression and branch logic (neutral/symbol/bonus/malus).

4. Draw/discard/shuffle
- per-game draw helpers reimplementing same deck lifecycle patterns.

5. Pending action orchestration
- repeated `pending` shape checks and resolve/clear logic.

6. Turn announcements and advancement
- repeated "c'est au tour de" and next-player calculations.

7. Presenter filtering
- repeated user-specific pending visibility rules and extras shaping.

## Target Architecture
Add thin policy-level modules over existing low-level modules:

1. `modules/setup-flow` (new)
- Standard setup state machine:
  - `startSetup`
  - `queueSelection`
  - `resolveSelection`
  - `finalizeSetup`

2. `modules/turn-policies` (new)
- Shared policies:
  - advance-on-success
  - stay-on-pending
  - skip/replay/reverse direction

3. `modules/deck-policies` (new)
- Shared draw lifecycle:
  - draw mandatory/optional
  - discard handling
  - auto reshuffle from discard

4. `modules/board-effects-policies` (new)
- Shared landing behaviors:
  - neutral
  - bonus/malus/surprise
  - chain effects

5. Presenter base enrichment
- Extend `engine/abstract/base-presenter.service.ts` to centralize:
  - pending visibility by user
  - standard extras mapping for board/grid/choices

## Migration Strategy
- Strangler approach: migrate game by game, no big bang.
- Keep behavior parity by snapshot tests and scenario tests.
- Each PR migrates a small cluster of games sharing the same flow.

## Execution Waves

### Wave 0 - Audit and RFC (current)
- Deliverables:
  - This plan
  - Game capability matrix (to add in `backend/src/game/MUTUALIZATION_MATRIX.md`)
  - PR backlog

### Wave 1 - Setup + pending standardization
- Build `setup-flow` module
- Reuse existing pending services where possible
- Pilot migration:
  - `vents-sacres/jeu-oie`
  - `vents-sacres/foulees-fantastiques`
  - `les-quatre-vents/en-attendant-minuit`

### Wave 2 - Deck lifecycle standardization
- Build `deck-policies` module on top of `cards`
- Pilot migration:
  - `les-quatre-vents/ca-derape`
  - `les-quatre-vents/contes-et-cacahuetes`
  - `vents-dansants/cat-pattes`

### Wave 3 - Board movement and landing effects
- Build `board-effects-policies`
- Pilot migration:
  - `les-quatre-vents/frousse-party`
  - `les-quatre-vents/aventure-sauvage`
  - `les-quatre-vents/voyage-en-terre-de-brumes`

### Wave 4 - Presenter and bot unification
- Base presenter enhancements + shared bot decision adapters
- Migrate highest-maintenance games first (`contes`, `sac-a-malices`, `frousse-party`)

### Wave 5 - Cleanup and convergence
- Remove dead duplicated helpers
- Align docs and templates for new games
- Add guardrails in scaffolding (`commands/create-game.cjs`) to default to shared modules

## PR Backlog (proposed)
1. `PR-01`: add `setup-flow` module and tests
2. `PR-02`: migrate `jeu-oie` to setup-flow
3. `PR-03`: migrate `foulees-fantastiques` to setup-flow
4. `PR-04`: migrate `en-attendant-minuit` to setup-flow
5. `PR-05`: add `deck-policies` module and tests
6. `PR-06`: migrate `ca-derape` draw lifecycle
7. `PR-07`: migrate `contes-et-cacahuetes` draw lifecycle
8. `PR-08`: migrate `cat-pattes` draw lifecycle
9. `PR-09`: add `board-effects-policies` module and tests
10. `PR-10`: migrate `frousse-party` landing effects
11. `PR-11`: migrate `aventure-sauvage` landing effects
12. `PR-12`: presenter base unification pass

## Definition Of Done (per PR)
1. Build passes (`backend`).
2. Existing game tests pass.
3. New tests cover migrated shared policy paths.
4. No behavior regression on critical scenarios:
- setup prompts
- pending visibility by user
- turn order announcements
- bot turn progression
- draw/reshuffle correctness

## Risks and Mitigations
1. Risk: hidden behavior coupling in large action services.
- Mitigation: migrate one game at a time with golden scenario tests.

2. Risk: pending state shape drift between games.
- Mitigation: enforce typed pending contracts in shared modules.

3. Risk: rollout fatigue across many games.
- Mitigation: strict PR slicing and per-wave checkpoints.

## Next Immediate Step
- Produce `MUTUALIZATION_MATRIX.md` with capability tags per game, then start `PR-01` (`setup-flow` module).
