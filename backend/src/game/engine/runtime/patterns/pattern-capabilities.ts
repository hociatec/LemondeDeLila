/** Authoring bridge for reusable patterns; patterns do not reach runtime kits directly. */
export { cards } from '../cards/cards-kit';
export type { CardValue } from '../cards/cards-kit';
export type { CardsSchemaDefinition } from '../cards/typed-cards';
export { diceKit } from '../kits/dice-kit';
export { economy } from '../kits/economy-kit';
export { grid, scanGridWinner, type GridPosition } from '../kits/grid-kit';
export { inventory } from '../kits/inventory-kit';
export { movement } from '../kits/movement-kit';
export { pawns, type PawnDefinition, type PawnMove } from '../kits/pawn-kit';
export { defineGamePhases } from '../kits/phase-kit';
export { commonStatuses } from '../kits/player-values-contracts';
export { quiz, type QuizQuestion } from '../kits/quiz-kit';
export { clockwise, simultaneous } from '../kits/turn-kit';
export type { TurnPolicy } from '../kits/turn-kit';
export type {
  GameLifecycleHooks,
  RoundLifecycleInput,
  TurnLifecycleInput,
} from '../lifecycle/game-lifecycle-hooks';
export {
  defineActorEffect,
  defineEffect,
  defineEmptyEffect,
} from '../effects/effects-core';
export { gameEffects } from '../effects/effects-dsl';
export type { GameEffectInstruction } from '../effects/effects-kit';
export {
  discardCard,
  drawAndResolve,
  drawEvent,
  drawForPlayer,
  eventTrackTurn,
  completeRound,
  playCard,
  raceTurn,
  requestCardFromPlayer,
  rollDice,
  sequentialPawnSelection,
  type EventTrackOptions,
} from '../recipes/gameplay-recipes';
export { resourceDeltaEffects } from '../recipes/resource-deltas';
export {
  composeGameConfigurations,
  type GameConfigurationShape,
} from '../configuration/configuration-kit';
