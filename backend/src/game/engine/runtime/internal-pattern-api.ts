/**
 * Runtime-local imports for native patterns. Unlike the public extension SDK,
 * this module deliberately does not export the JSON compiler factory, avoiding
 * a compiler -> pattern -> SDK -> compiler initialization cycle.
 */
export {
  assertUniqueAuthorIds,
  assertUniqueAuthorValues,
  authoringFailure,
  authoringProperty,
} from './contracts/authoring-diagnostics';
export type { AuthoringFailure } from './contracts/authoring-diagnostics';
export { AuthoringError, authoringValueAt } from './contracts/authoring-error';
export {
  authorArray,
  authorBoolean,
  authorId,
  authorInteger,
  authorNumber,
  authorObject,
  authorPositive,
  authorRecord,
  authorRef,
} from './contracts/json-author-schema';
export type { AuthorSchema } from './contracts/json-author-schema';
export type {
  BoardGameProgram,
  BoardLanding,
} from './contracts/board-landing-contract';
export type { ChoiceResolverShape } from './contracts/author-rule-contracts';
export type { GameContext } from './definitions/game-author-context';
export type { PlayerMap } from './game-identifiers';
export type { GameEffectResolverShape } from './contracts/effect-resolver';
export {
  defineAction,
  defineChoice,
  defineEmptyAction,
} from './actions/action-builders';
export { gameInput } from './actions/game-input-schema';
export { defineConfiguration } from './configuration/configuration-kit';
export { defineEvent } from './events/game-event-definition';
export {
  defineActorEffect,
  defineEffect,
  defineEmptyEffect,
} from './effects/effects-core';
export { defineEffectRecipe, gameEffects } from './effects/effects-kit';
export type {
  DefinedGameEffectResolver,
  GameEffectInstruction,
} from './effects/effects-kit';
export { effectJsonSchema } from './contracts/effect-json-schema';
export type { GameComponentDefinition } from './definitions/component-kit';
export type { GamePhaseSet } from './kits/phase-kit';
export { defineGamePhases, setupPlayingPhases } from './kits/phase-kit';
export { commonStatuses } from './kits/player-values-kit';
export { cards } from './cards/cards-kit';
export { defineCardsSchema } from './cards/typed-cards';
export { inventory } from './kits/inventory-kit';
export { movement } from './kits/movement-kit';
export { ownership } from './kits/ownership-kit';
export { pawns } from './kits/pawn-kit';
export { quiz } from './kits/quiz-kit';
export type { QuizQuestion } from './kits/quiz-kit';
export { publicField } from './kits/visibility-kit';
export { when } from './automation/automatic-kit';
export {
  GameRuleViolationError,
  GameStateViolationError,
  rejectRule,
} from './contracts/game-domain.errors';
export type { GridPosition } from './kits/grid-kit';
export { isRecord } from './content/content-guards';
export {
  completeRound,
  drawAndResolve,
  drawEvent,
  drawForPlayer,
  raceTurn,
  resolveTrackMovement,
  sequentialPawnSelection,
} from './recipes/gameplay-recipes';
export {
  cardGame,
  gridGame,
  raceGame,
  roundScoring,
} from './patterns/gameplay-patterns';
