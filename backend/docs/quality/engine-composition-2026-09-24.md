# Composition audit: 44 points, 24 September 2026

The original request is preserved verbatim in engine-composition-source-2026-09-24.md and corriger.txt. This register distinguishes new changes from retained capabilities. Closure requires the associated validation campaign; the register is authoritative for status. Point 44 was truncated in the supplied file; its available invariant requirements are covered below.

## 1. Real shared extraction

The resource-delta recipe is used by two different production packs (ordered parade and resource-track race). Specific mechanics stay outside the runtime.

Implementation: `src/game/rules/recipes/resource-deltas.ts`, `src/game/rules/game-specific/cards-ordered-parade/parade.recipes.ts`, `src/game/rules/game-specific/race-resource-track/resource-track-race.recipes.ts`.

Validation: `tools/game-mechanics-matrix.spec.cjs`, `src/game/testing/architecture-tests/game/reference-replays.spec.ts`.

## 2. Catalogue matrix

All 39 games and 38 packs are mapped across 14 categories. Every positive cell links to source lines. Empty cells explicitly mean no direct static evidence, not absence of a capability.

Implementation: `tools/game-mechanics-matrix.cjs`, `docs/quality/game-mechanics-matrix.json`.

Validation: `tools/game-mechanics-matrix.spec.cjs`.

## 3. Composable conditions

Existing all/any/not, ownership, position, resources and statuses are extended with phase-is and bounded numeric comparison.

Implementation: `src/game/engine/runtime/effects/effect-condition-evaluator.ts`, `src/game/engine/runtime/effects/game-effect-reference-validator.ts`.

Validation: `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`, `src/game/testing/architecture-tests/json/json-standard-victory.spec.ts`.

## 4. Common selectors

Current player and predicate-selected participants join existing self/opponents/next/previous. Owners and occupants use predicates over canonical controllers.

Implementation: `src/game/engine/runtime/effects/effect-target-resolver.ts`, `src/game/engine/runtime/effects/effects-dsl.ts`.

Validation: `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 5. Bounded expressions

Thirteen expression variants cover constants, canonical reads, arithmetic, min/max and clamp. Hand/inventory/player counts use their canonical controllers.

Implementation: `src/game/engine/runtime/effects/numeric-expression-evaluator.ts`, `src/game/engine/runtime/contracts/numeric-expression.ts`.

Validation: `src/game/engine/runtime/effects/numeric-expression.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 6. Closed deterministic DSL

Schema validation rejects functions, arbitrary property access and unknown instructions. Expressions and triggers have depth/node/execution budgets; division by zero and unsafe results fail.

Implementation: `src/game/engine/runtime/contracts/effect-json-schema.ts`, `src/game/engine/runtime/effects/numeric-expression-validator.ts`, `src/game/engine/runtime/automation/trigger-resolution.ts`.

Validation: `src/game/engine/runtime/effects/numeric-expression.spec.ts`, `src/game/testing/architecture-tests/game/declarative-triggers.spec.ts`.

## 7. Configurable resources

resource.pool declares initial/min/max independently of resource identity. Balances remain solely in playerValues.resources; declared bounds apply to mutation and restoration.

Implementation: `src/game/engine/runtime/kits/resource-controller.ts`, `src/game/engine/runtime/kits/resource-definition.ts`, `src/game/engine/runtime/state/restored-session-header.ts`.

Validation: `src/game/engine/runtime/kits/resource-bounds.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 8. Payment workflow

quoteResourcePayment computes affordability and settlement before mutation. Controller operations share the same calculation; elimination remains a match decision.

Implementation: `src/game/engine/runtime/kits/resource-payment.ts`, `src/game/engine/runtime/kits/resource-controller.ts`, `src/game/engine/runtime/kits/resource-exchange.ts`.

Validation: `src/game/engine/runtime/kits/resource-payment.spec.ts`, `src/game/engine/runtime/kits/resource-bounds.spec.ts`.

## 9. Insufficient funds policies

Explicit cancel, debt, partial and eliminate policies are supported. Existing allowPartial and default rejection retain their semantics. Explicit resource bounds cannot be bypassed by debt.

Implementation: `src/game/engine/runtime/contracts/resource-payment.ts`, `src/game/engine/runtime/effects/effect-primitive-handlers.ts`.

Validation: `src/game/engine/runtime/kits/resource-payment.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 10. Status lifecycle

Status buckets identify targets canonically. Optional source, charges, categories and parameters join duration and expiry. Charge consumption is independent of turn expiry.

Implementation: `src/game/engine/runtime/kits/player-values-kit.ts`, `src/game/engine/runtime/kits/player-values-contracts.ts`, `src/game/engine/runtime/kits/numeric-invariants.ts`.

Validation: `src/game/engine/runtime/kits/status-modifiers.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 11. Generic protections

Effect categories are intercepted before mutation. Exact effect kinds and movement/resource/card/inventory loss categories consume one matching protection charge.

Implementation: `src/game/engine/runtime/effects/effect-target-resolver.ts`, `src/game/engine/runtime/kits/player-values-kit.ts`.

Validation: `src/game/engine/runtime/kits/status-modifiers.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 12. Movement and consequences

The existing movement controller owns displacement and emits events. Landing/pass recipes and the new event triggers compose consequences separately.

Implementation: `src/game/engine/runtime/kits/movement-kit.ts`, `src/game/engine/runtime/automation/trigger-resolution.ts`.

Validation: `src/game/engine/runtime/kits/movement-kit.spec.ts`, `src/game/testing/architecture-tests/game/declarative-triggers.spec.ts`.

## 13. Movement configuration

Track overshoot supports clamp/wrap/bounce/exact; signed moves, teleport, blocked landing pipelines and pawn/grid capabilities preserve their specialized topology contracts.

Implementation: `src/game/engine/runtime/kits/movement-kit.ts`, `src/game/engine/runtime/effects/effect-primitive-handlers.ts`.

Validation: `src/game/engine/runtime/kits/movement-kit.spec.ts`, `src/game/testing/architecture-tests/game/generated-capability-models.property.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 14. Collision detection and resolution

Detection uses canonical positions/occupants; effects resolve independently through selectors and displacement or ownership operations. No game-specific collision policy enters the core.

Implementation: `src/game/engine/runtime/kits/movement-kit.ts`, `src/game/engine/runtime/effects/effect-target-resolver.ts`.

Validation: `src/game/testing/architecture-tests/game/directional-hazard-primitives-parity.spec.ts`, `src/game/testing/architecture-tests/game/generated-capability-models.property.spec.ts`.

## 15. Card locations

Deck, hand, discard and named zones are canonical locations. Market/removed areas are ordinary public/private zones. moveCard validates both endpoints before mutating one occurrence.

Implementation: `src/game/engine/runtime/cards/cards-location-controller.ts`, `src/game/engine/runtime/contracts/card-location.ts`.

Validation: `src/game/engine/runtime/cards/cards-location.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 16. Card operations

Existing draw, transfer, discard, zone visibility, shuffle and selection controllers remain common. move-card adds JSON/API movement between all location kinds without duplicating card storage.

Implementation: `src/game/engine/runtime/cards/cards-deck-controller.ts`, `src/game/engine/runtime/cards/cards-hands-controller.ts`, `src/game/engine/runtime/cards/cards-location-controller.ts`.

Validation: `src/game/engine/runtime/cards/cards-location.spec.ts`, `src/game/engine/runtime/cards/cards-exchange.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 17. Shared interactions

Existing choice/submission/vote controllers define participants, options, private answers, validation and completion. Domain recipes compose these capabilities rather than storing alternate interaction state.

Implementation: `src/game/engine/runtime/contracts/context-interactions-capability.ts`, `src/game/engine/runtime/submissions/submission-flow-controller.ts`, `src/game/engine/runtime/choices/game-choice-controller.ts`.

Validation: `src/game/engine/runtime/submissions/submission-workflow-invariants.spec.ts`, `src/game/engine/runtime/submissions/submission-voting-controller.spec.ts`.

## 18. Collections

Existing set completion and request-card recipes operate on canonical hands. Completion moves cards once and derived collection views read the resulting state.

Implementation: `src/game/engine/runtime/cards/cards-hands-controller.ts`, `src/game/engine/runtime/recipes/gameplay/card-actions.recipes.ts`, `src/game/engine/runtime/projection/collection-view.ts`.

Validation: `src/game/engine/runtime/cards/cards-exchange.spec.ts`, `src/game/testing/architecture-tests/game/generated-capability-models.property.spec.ts`.

## 19. Ownership semantics

Registry assets use the shared ownership controller. Card possession is canonical in card locations and inventory possession in inventory buckets; no parallel ownership registry is introduced for either.

Implementation: `src/game/engine/runtime/kits/ownership-kit.ts`, `src/game/engine/runtime/cards/cards-location-controller.ts`, `src/game/engine/runtime/state/component-state-ownership.ts`.

Validation: `src/game/engine/runtime/kits/ownership-kit.spec.ts`, `src/game/testing/architecture-tests/game/generated-capability-models.property.spec.ts`, `tools/game-state-ownership-audit.spec.cjs`.

## 20. Declarative triggers

Patterns declare action or event triggers with scalar event filters. Existing movement/turn/resource/card events feed the same bounded dispatcher. Trigger effects cannot suspend for an interactive choice.

Implementation: `src/game/engine/runtime/automation/trigger-pattern.ts`, `src/game/engine/runtime/automation/trigger-resolution.ts`, `src/game/engine/runtime/automation/trigger-validation.ts`.

Validation: `src/game/testing/architecture-tests/game/declarative-triggers.spec.ts`.

## 21. Composition pipeline

Triggers dispatch conditions, target selectors and numeric expressions into existing effect primitives. JSON and TypeScript builders share the same compiled trigger definitions.

Implementation: `src/game/engine/runtime/automation/trigger-resolution.ts`, `src/game/engine/runtime/effects/effect-condition-evaluator.ts`, `src/game/engine/runtime/effects/effect-target-resolver.ts`.

Validation: `src/game/testing/architecture-tests/game/declarative-triggers.spec.ts`, `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`.

## 22. Composable victory

conditionVictory evaluates local predicates per participant, with all/any/not composition and explicit tie policy. Existing score/resource/position/collection predicates need no custom callback.

Implementation: `src/game/engine/runtime/automation/condition-victory.ts`, `src/game/engine/runtime/definitions/json-standard-victory.ts`.

Validation: `src/game/testing/architecture-tests/json/json-standard-victory.spec.ts`.

## 23. Recipes outside core

resourceDeltaEffects lives above the runtime and composes public instructions. Two production packs consume it while keeping their reward/tile policies.

Implementation: `src/game/rules/recipes/resource-deltas.ts`.

Validation: `tools/game-mechanics-matrix.spec.cjs`, `src/game/testing/architecture-tests/game/reference-replays.spec.ts`.

## 24. Specific packs remain specific

All 38 packs remain classified as specific. No promotion is claimed merely because a pack has configuration. Common recipe extraction does not reverse dependency direction.

Implementation: `tools/engine-effect-pack-governance.cjs`, `tools/effect-pack-promotion.cjs`.

Validation: `tools/engine-effect-pack-governance.spec.cjs`, `tools/effect-pack-promotion.spec.cjs`.

## 25. Responsibility splitting

Common resource-delta loops leave two packs; resource and card-location responsibilities have dedicated controllers. Existing pack size and production/behavior line budgets remain unchanged.

Implementation: `src/game/rules/recipes/resource-deltas.ts`, `src/game/engine/runtime/kits/resource-controller.ts`, `src/game/engine/runtime/cards/cards-location-controller.ts`.

Validation: `tools/engine-effect-pack-governance.spec.cjs`, `tools/structural-quality-check.spec.cjs`.

## 26. Evidence-based reuse governance

Promotion gates require independent consumers and an ADR. The new recipe has a test locating actual calls from two catalogue games.

Implementation: `tools/effect-pack-promotion.cjs`, `tools/game-mechanics-matrix.cjs`.

Validation: `tools/effect-pack-promotion.spec.cjs`, `tools/game-mechanics-matrix.spec.cjs`.

## 27. Dependency direction

Existing AST import and dependency-cycle checks protect runtime/rules/core direction. Trigger validation is separate from pattern construction to avoid a runtime cycle.

Implementation: `tools/runtime-dependency-graph.cjs`, `src/game/engine/runtime/automation/trigger-validation.ts`.

Validation: `tools/runtime-dependency-graph.spec.cjs`, `tools/runtime-contract-imports.spec.cjs`.

## 28. Public facades

Authors and extensions use their explicit facades. New contracts and builders are exported intentionally; pack imports remain checked against deep runtime access.

Implementation: `src/game/engine/sdk/author-api.ts`, `src/game/engine/sdk/extension-api.ts`.

Validation: `tools/extension-api-boundary.spec.cjs`.

## 29. Versioned author API

Author/public API is 10.0.0. Transitive declarations are snapshotted; amount unions and new exhaustive variants are documented as a major migration.

Implementation: `tools/sdk-contract-check.cjs`, `tools/sdk-author-api-reference.json`, `docs/architecture/sdk-contract.md`.

Validation: `tools/sdk-contract-check.spec.cjs`.

## 30. Versioned extension API

Extension API/contracts are 2.0.0, including the widened amount and component contracts. Four independently checked snapshots cover all facades.

Implementation: `tools/sdk-extension-api-reference.json`, `tools/sdk-extension-contracts-reference.json`, `docs/architecture/extension-compatibility.md`.

Validation: `tools/sdk-contract-check.spec.cjs`.

## 31. JSON/API parity

Exhaustive primitive cases include new expressions, selectors, payments, protections and card movement. Assertions compare engine state, events and deterministic replay; trigger parity uses three seeds.

Implementation: `src/game/testing/architecture-tests/game/primitive-parity-cases.ts`, `src/game/testing/architecture-tests/game/numeric-expression-cases.ts`.

Validation: `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`, `src/game/testing/architecture-tests/game/declarative-triggers.spec.ts`.

## 32. Closed core JSON

New behavior enters closed component/pattern/condition/effect variants. No game-business root fields or arbitrary state-path expressions are added.

Implementation: `src/game/engine/runtime/definitions/json-game-schema.ts`, `src/game/engine/runtime/contracts/effect-json-schema.ts`.

Validation: `src/game/testing/architecture-tests/json/json-author-limits.spec.ts`, `tools/engine-catalog-boundary.spec.cjs`.

## 33. Controlled vocabulary

Existing semantic conditions compose owners/occupants and victory rules. New variants represent reusable capabilities; market and removed zones need no dedicated business keywords.

Implementation: `src/game/engine/runtime/contracts/effect-ir.ts`, `src/game/engine/runtime/contracts/numeric-expression.ts`, `src/game/engine/runtime/contracts/card-location.ts`.

Validation: `src/game/testing/architecture-tests/game/primitive-json-sdk-parity.spec.ts`, `tools/engine-effect-pack-governance.spec.cjs`.

## 34. Structured diagnostics

Author schemas and reference validators retain path/origin diagnostics. SDK effect sequences now pass closed schema validation before typed semantic validation.

Implementation: `src/game/engine/runtime/contracts/authoring-diagnostics.ts`, `src/game/engine/runtime/effects/game-effect-definition-validator.ts`.

Validation: `src/game/testing/architecture-tests/json/authoring-semantic-paths.spec.ts`, `src/game/testing/architecture-tests/json/json-pattern-diagnostics.spec.ts`.

## 35. Validated type boundaries

The effect validator no longer asserts an unknown object to GameEffectInstruction. It uses the asserting closed schema codec. Existing double-cast lint and facade rules remain enforced.

Implementation: `src/game/engine/runtime/effects/game-effect-definition-validator.ts`, `src/game/engine/runtime/contracts/effect-json-schema.ts`.

Validation: `tools/double-cast-lint.spec.cjs`, `src/game/testing/architecture-tests/json/authoring-semantic-paths.spec.ts`.

## 36. Schema/type CI contracts

New schemas satisfy AuthorSchema, and exhaustive cases cover new discriminated unions. Typecheck, schema tests and merge-contract tests remain in the required workflow.

Implementation: `src/game/engine/runtime/contracts/numeric-expression-schema.ts`, `src/game/engine/runtime/contracts/declarative-trigger-schema.ts`, `package.json`.

Validation: `tools/author-schema-types.spec.cjs`, `tools/engine-ci-contract.spec.cjs`.

## 37. Formal state ownership

Ownership declarations now include resource pools and canonical player values. Restoration validates resource bounds and status metadata rather than inferring fields.

Implementation: `src/game/engine/runtime/state/component-state-ownership.ts`, `src/game/engine/runtime/state/restored-session-header.ts`.

Validation: `src/game/engine/runtime/state/component-state-ownership.spec.ts`, `tools/game-state-ownership-audit.spec.cjs`.

## 38. Canonical storage

Expressions, selectors and cards read/write controller-owned state. Resource pools retain only static bounds in definitions. No second score, hand, inventory or position map is introduced.

Implementation: `src/game/engine/runtime/effects/numeric-expression-evaluator.ts`, `src/game/engine/runtime/cards/cards-location-controller.ts`, `src/game/engine/runtime/state/component-state-ownership.ts`.

Validation: `src/game/testing/architecture-tests/game/generated-capability-models.property.spec.ts`, `src/game/engine/runtime/cards/cards-location.spec.ts`, `tools/game-state-ownership-audit.spec.cjs`.

## 39. Static content isolation

Existing immutable content and setup isolation contracts remain. New resource/trigger definitions are compiled as static definitions, while session state contains only mutable values.

Implementation: `src/game/engine/runtime/content/content-immutability.ts`, `src/game/engine/runtime/definitions/game-definition-compiler.ts`.

Validation: `src/game/engine/runtime/state/setup-state-isolation.spec.ts`, `src/game/engine/runtime/content/game-content.spec.ts`.

## 40. Deterministic execution

Expressions are pure canonical reads. Triggers use deterministic order and bounded dispatch. Replay corpus compares live, replayed and restored state for identical seeds/commands/version.

Implementation: `src/game/engine/runtime/effects/numeric-expression-evaluator.ts`, `src/game/engine/runtime/automation/trigger-resolution.ts`.

Validation: `src/game/testing/architecture-tests/game/reference-replays.spec.ts`, `tools/business-clock-lint.spec.cjs`.

## 41. Injected RNG

Existing seeded RNG is the only randomness source for rules. Numeric expressions and selectors add no system randomness; generated actions and reference replays exercise seeded choices.

Implementation: `src/game/core/application/random/seeded-rng.ts`.

Validation: `src/game/core/application/random/seeded-rng.spec.ts`, `src/game/testing/architecture-tests/game/generated-actions.property.spec.ts`, `tools/architecture-check.spec.cjs`.

## 42. All catalogue replays

Every one of the 39 games runs a bounded command campaign. The six historical references are retained, and all additional references are checked without snapshot update.

Implementation: `src/game/testing/architecture-tests/game/reference-replays.spec.ts`, `src/game/testing/architecture-tests/game/__snapshots__/reference-replays.spec.ts.snap`.

Validation: `src/game/testing/architecture-tests/game/reference-replays.spec.ts`.

## 43. Multiple seeds

Each game runs seeds 11, 23 and 67, plus historical non-overlapping seed cases: 120 references. A legitimate event burst exposed the 128-event buffer limit; it is now bounded at 512 and overflow remains tested.

Implementation: `src/game/testing/architecture-tests/game/reference-replays.spec.ts`, `src/game/core/application/services/game-event-buffer.ts`.

Validation: `src/game/testing/architecture-tests/game/reference-replays.spec.ts`, `src/game/core/application/services/game-event-buffer.spec.ts`.

## 44. Generated invariant models

Existing generated movement/resource/RNG and card/inventory/ownership campaigns are retained. Payment tests add exhaustive independent balance/cost/policy models, and expression/trigger tests cover invalid and cyclic effects.

Implementation: `src/game/testing/architecture-tests/game/generated-capability-models.property.spec.ts`, `src/game/testing/architecture-tests/game/generated-actions.property.spec.ts`, `src/game/engine/runtime/kits/resource-payment.spec.ts`.

Validation: `src/game/testing/architecture-tests/game/generated-capability-models.property.spec.ts`, `src/game/testing/architecture-tests/game/generated-actions.property.spec.ts`, `src/game/engine/runtime/kits/resource-payment.spec.ts`, `src/game/engine/runtime/effects/numeric-expression.spec.ts`, `src/game/testing/architecture-tests/game/declarative-triggers.spec.ts`.

## Validation and closure

All 44 available points are closed after the source-specific implementations and retained contracts above were checked. The original audit remains intact; closure is recorded separately.

On code commit `edcbb09e511d5c258011172005ac2a177fc1a678`, local typecheck, changed TypeScript lint and the complete quality:check passed. Targeted campaigns passed 636 JSON/API/diagnostic tests and 28 final regression tests. GitHub run [35990513398](https://github.com/hociatec/LemondeDeLila/actions/runs/35990513398) passed quality, the full merge-contract campaign (including 120 reference replays without snapshot updates), and authoring diagnostics on Node 24/Linux.

Full integration and release-artifact certification remain mandatory on the final PR head before merge. These gates are separate from this point-by-point implementation register; this report does not claim they finished before they ran.

The broader local game campaign ran 277 suites / 2,743 tests with all 120 snapshots passing. It exposed two legacy diagnostic regressions (definition identity and error class). Closed-schema errors now pass through the caller's failure adapter, preserving precise paths and the existing definition context. The two failing suites and four related diagnostic/parity suites were rerun: 389 tests passed. Both regression suites are now included in engine:merge-contracts. Typecheck, changed-file lint, structural checks and the dependency/CI contract tests passed after this correction. Final-head GitHub certification remains the merge gate.
