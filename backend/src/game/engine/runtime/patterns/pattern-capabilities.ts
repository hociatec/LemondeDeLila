/** Authoring bridge for reusable patterns; patterns do not reach runtime kits directly. */
export { cards } from '../cards/cards-kit';
export type { CardValue } from '../cards/cards-kit';
export type { CardsSchemaDefinition } from '../cards/typed-cards';
export { diceKit } from '../kits/dice-kit';
export { economy } from '../kits/economy-kit';
export { grid } from '../kits/grid-kit';
export { inventory } from '../kits/inventory-kit';
export { movement } from '../kits/movement-kit';
export { pawns, type PawnDefinition } from '../kits/pawn-kit';
export { quiz, type QuizQuestion } from '../kits/quiz-kit';
export { clockwise, simultaneous } from '../kits/turn-kit';
export type { TurnPolicy } from '../kits/turn-kit';
export type {
  GameLifecycleHooks,
  RoundLifecycleInput,
  TurnLifecycleInput,
} from '../lifecycle/game-lifecycle-hooks';
export type { GameEffectInstruction } from '../effects/effects-kit';
export {
  eventTrackTurn,
  completeRound,
  type EventTrackOptions,
} from '../recipes/gameplay-recipes';
export {
  composeGameConfigurations,
  type GameConfigurationShape,
} from '../configuration/configuration-kit';
