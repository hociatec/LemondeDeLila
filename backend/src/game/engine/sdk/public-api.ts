/** Stable V2 authoring surface for concrete games. Keep it explicit. */
export {
  defineAction,
  defineChoice,
  defineGame,
} from '../runtime/definitions/game-definition';
export type {
  GameActionDefinition,
  NoGameState,
} from '../runtime/definitions/game-definition';

export {
  boardContent,
  cardContent,
  defineGameContent,
  freezeGameContent,
  loadGameContent,
  quizContent,
  trackContent,
} from '../runtime/content/game-content';
export type { GameContent } from '../runtime/content/game-content';
export { gameInput } from '../runtime/actions/game-input-schema';
export { defineEvent } from '../runtime/events/game-event-definition';
export { defineConfiguration } from '../runtime/configuration/configuration-kit';
export type {
  GameContext,
  GameContextFor,
  GameCounterIdOf,
  GameResourceIdOf,
} from '../runtime/game-rule-context';

export { commonStatuses } from '../runtime/kits/player-values-kit';
export {
  defineGamePhases,
  setupPlayingPhases,
} from '../runtime/kits/phase-kit';
export { when, victoryWhen } from '../runtime/automation/automatic-kit';
export { cards } from '../runtime/cards/cards-kit';
export { defineCardsSchema } from '../runtime/cards/typed-cards';
export { inventory } from '../runtime/kits/inventory-kit';
export { collection } from '../runtime/projection/collection-view';
export { movement } from '../runtime/kits/movement-kit';
export { ownership } from '../runtime/kits/ownership-kit';
export { pawns } from '../runtime/kits/pawn-kit';
export type { PawnMove } from '../runtime/kits/pawn-kit';
export { quiz } from '../runtime/kits/quiz-kit';
export type { QuizQuestion } from '../runtime/kits/quiz-kit';
export { scanGridWinner } from '../runtime/kits/grid-kit';

export {
  defineEffect,
  defineEffectRecipe,
  gameEffects,
} from '../runtime/effects/effects-kit';
export type {
  DefinedGameEffectResolver,
  EffectTarget,
  GameEffectInstruction,
} from '../runtime/effects/effects-kit';

export {
  completeRound,
  discardCard,
  drawAndResolve,
  drawEvent,
  drawForPlayer,
  playCard,
  positionOf,
  raceTurn,
  requestCardFromPlayer,
  rollDice,
  sequentialPawnSelection,
} from '../runtime/recipes/gameplay-recipes';
export {
  cardGame,
  drawCardsAtTurnStart,
  gridGame,
  marketGame,
  pawnRace,
  quizRace,
  raceGame,
  roundScoring,
  simultaneousAnswers,
  submissionJudgeGame,
} from '../runtime/patterns/gameplay-patterns';

export { playerId } from '../runtime/game-identifiers';
export type { PlayerMap } from '../runtime/game-identifiers';
export { publicField } from '../runtime/kits/visibility-kit';
export type {
  StableGameKitsView,
  StableGameSystemView,
} from '../runtime/projection/game-system-view';

export {
  rejectContent,
  rejectRule,
} from '../../core/domain/errors/game-domain.errors';
export { testGame } from '../../core/testing/game-test-kit';
