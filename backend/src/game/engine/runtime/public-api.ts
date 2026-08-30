export {
  GAME_SDK_VERSION,
  GAME_STATE_MUTATION_POLICY,
} from './game-sdk-version';

export {
  defineAction,
  defineChoice,
  defineGame,
  gameViewExtension,
  overrideAction,
} from './definitions/game-definition';
export type {
  AutomaticRule,
  ChoiceResolver,
  ChoiceResolverShape,
  ChoiceResolution,
  CompiledGameDefinition,
  DefinedChoiceResolver,
  DeclarativeState,
  DefinedGameAction,
  GameActionDefinition,
  GameActionDecision,
  GameActionExecution,
  GameActionInput,
  GameActionMap,
  GameActionUiHint,
  GameChoiceUiHint,
  GameContentMigration,
  GameViewExtension,
  GameDefinition,
  GameSession,
  GameStateMigration,
  NoGameState,
  RawChoiceResolution,
  VictoryRule,
} from './definitions/game-definition';
export type {
  GameStatusPlayerView,
  GameSetupPlayerView,
  GameSetupPlayerViewFor,
  GamePlayersPlayerView,
  GameEventsPlayerView,
  GameEventPlayerView,
  EffectSourcePlayerView,
  GameTurnPlayerView,
  GenericBoardPlayerView,
  GenericGamePlayerView,
  GamePlayerViewFor,
  MatchPlayerView,
  RoundPlayerView,
  StableGameKitsView,
  StableGameSystemView,
} from './projection/game-system-view';
export { GAME_SYSTEM_VIEW_VERSION } from './projection/game-system-view';
export type {
  DicePlayerView,
  DiceSetPlayerView,
  GameKitsPlayerView,
  MovementPlayerView,
  PawnSetsPlayerView,
} from './projection/game-kit-view';
export {
  boardContent,
  cardContent,
  contentManifest,
  defineGameContent,
  freezeGameContent,
  loadGameContent,
  quizContent,
  trackContent,
} from './content/game-content';
export type {
  GameContent,
  GameContentManifest,
  GameContentSchema,
  GameContentShape,
  IdentifiedGameContent,
  LinkedBoardContent,
} from './content/game-content';
export { assertUniqueContentIds } from './content/game-content';
export { gameInput } from './actions/game-input-schema';
export type { GameInputSchema } from './actions/game-input-schema';
export { defineEvent, defineEvents } from './events/game-event-definition';
export type {
  GameEventDefinition,
  GameEventMapOf,
} from './events/game-event-definition';
export { defineSelector, memoizeSelector, selectAll } from './game-selectors';
export type { GameSelector } from './game-selectors';
export {
  defineTieBreaker,
  endConditions,
  endRoundWhen,
  rankWithTieBreakers,
  victoryConditions,
} from './lifecycle/game-end-conditions';
export type {
  GameCondition,
  GameConditionInput,
  GameTieBreaker,
} from './lifecycle/game-end-conditions';
export {
  defineConfiguration,
  GAME_CONFIGURE_ACTION,
  overrideConfiguration,
} from './configuration/configuration-kit';
export type {
  ConfigurationValuesOf,
  GameConfigurationDefinition,
  GameConfigurationState,
  GameConfigurationUi,
} from './configuration/configuration-kit';
export {
  GameContext,
  type GameContextFor,
  type GameCounterIdOf,
  type GameResourceIdOf,
} from './game-rule-context';
export type {
  DomainEvent,
  EngineEventMap,
  EventDataMap,
  EventVisibility,
} from './game-rule-context';
export {
  ENGINE_EVENT_VISIBILITY,
  engineEventVisibility,
  isEngineEventType,
} from './events/engine-event-registry';
export type {
  EngineEventType,
  EngineEventVisibilityPolicy,
  EventValue,
} from './events/engine-event-registry';
export {
  createGameSchedulerState,
  GameSchedulerController,
  nextScheduledAction,
  projectScheduler,
} from './automation/scheduler-kit';
export type {
  GameSchedulerState,
  ScheduledGameTask,
  SchedulerVisibility,
} from './automation/scheduler-kit';
export { rejectRule } from '../../core/domain/errors/game-domain.errors';
export {
  standardTurn,
  clockwise,
  simultaneous,
  actionPoints,
} from './kits/turn-kit';
export type { TurnPolicy } from './kits/turn-kit';
export { commonStatuses } from './kits/player-values-kit';
export type {
  CommonStatusId,
  PlayerStatus,
  PlayerValuesVisibility,
  ScorePlayerView,
  StatusScope,
} from './kits/player-values-kit';
export {
  overrideComponent,
  overrideInitialization,
} from './definitions/component-kit';
export { overrideTurn } from './kits/turn-kit';
export { defineGamePhases, phase, setupPlayingPhases } from './kits/phase-kit';
export type {
  GamePhaseId,
  GamePhaseSet,
  PhaseConfiguration,
} from './kits/phase-kit';
export type {
  GameLifecycleHooks,
  RoundLifecycleInput,
  TurnLifecycleInput,
} from './lifecycle/game-lifecycle-hooks';
export { when, victoryWhen } from './automation/automatic-kit';
export {
  allConditions,
  allValidators,
  anyCondition,
  existingPawn,
  legalMove,
  otherPlayer,
  ownCard,
  positiveInteger,
  whenHasCard,
  whenNoPending,
  whenPhase,
  whenResourceAtLeast,
  whenTurnOfActor,
} from './actions/action-conditions';
export type {
  ActionCondition,
  ActionValidator,
} from './actions/action-conditions';
export { cards } from './cards/cards-kit';
export { defineCardsSchema } from './cards/typed-cards';
export type {
  CardDefinition,
  CardInstance,
  CardZone,
  CardSetsDefinition,
  CardZoneDefinition,
  DeckDefinition,
  HandsDefinition,
} from './cards/cards-kit';
export type {
  CardDeckMap,
  CardHandMap,
  CardOfDeck,
  TypedCardsKitState,
  TypedCardsRuntime,
  TypedCardZoneDefinition,
  CardZoneMap,
  TypedHandDefinition,
} from './cards/typed-cards';
export { inventory } from './kits/inventory-kit';
export type {
  InventoryDefinition,
  InventoryKitState,
} from './kits/inventory-kit';
export { collection } from './projection/collection-view';
export type {
  CollectionPlayerView,
  CollectionValueSource,
  CollectionViewDefinition,
} from './projection/collection-view';
export { economy } from './kits/economy-kit';
export type { EconomyKitState, MarketDefinition } from './kits/economy-kit';
export { ownership } from './kits/ownership-kit';
export type {
  OwnershipDefinition,
  OwnershipKitState,
} from './kits/ownership-kit';
export { GameRankingController } from './kits/ranking-kit';
export type { RankingCriterion, RankingEntry } from './kits/ranking-kit';
export { movement } from './kits/movement-kit';
export type {
  MovementLanding,
  MovementLandingOptions,
  MovementPipelineOptions,
  TrackDefinition,
} from './kits/movement-kit';
export { diceKit } from './kits/dice-kit';
export type {
  DiceDefinition,
  DiceRollPolicy,
  DiceRollResult,
} from './kits/dice-kit';
export { pawns } from './kits/pawn-kit';
export type {
  PawnDefinition,
  PawnKitState,
  PawnMove,
  PawnSetDefinition,
} from './kits/pawn-kit';
export { grid, scanGridWinner } from './kits/grid-kit';
export type { GridDefinition, GridPosition } from './kits/grid-kit';
export { quiz } from './kits/quiz-kit';
export type { QuizDefinition, QuizQuestion } from './kits/quiz-kit';
export {
  defineEffect,
  defineEffectRecipe,
  gameEffects,
} from './effects/effects-kit';
export type {
  EffectEngineState,
  EffectCondition,
  EffectTarget,
  GameEffectInstruction,
  EffectSource,
  GameEffectResolver,
  DefinedGameEffectResolver,
  GameEffectResolverShape,
} from './effects/effects-kit';
export type { EffectEngineDebugSnapshot } from './effects/effect-engine';
export type { SubmissionFlowStage } from './submissions/submission-kit';
export {
  answerQuiz,
  chooseTarget,
  collectSets,
  completeRound,
  completeSet,
  discardCard,
  drawAndResolve,
  drawEvent,
  drawForPlayer,
  drawCard,
  drawThenResolve,
  eventTrackTurn,
  eliminateAtScore,
  giveCard,
  lastPlayerStanding,
  leaveRound,
  moveCurrentPlayer,
  movePawn,
  passTurn,
  playCard,
  positionOf,
  raceTurn,
  rollAndMove,
  rollDice,
  requestCardFromPlayer,
  revealSubmissions,
  scoreHand,
  scoreUniqueCards,
  sequentialPawnSelection,
  skipTurn,
  stealCard,
  submitSecret,
  swapHands,
  vote,
  winAtScore,
} from './recipes/gameplay-recipes';
export type {
  CompleteRoundOptions,
  DrawAndResolveOptions,
  DrawForPlayerOptions,
  EventTrackOptions,
  TileDefinition,
  TileResolutionInput,
  TileResolutionRule,
} from './recipes/gameplay-recipes';
export {
  cardGame,
  collectionGame,
  composePatterns,
  definePattern,
  drawCardsAtTurnStart,
  economyGame,
  eventTrackGame,
  gridGame,
  marketGame,
  pushYourLuck,
  raceGame,
  pawnRace,
  quizRace,
  roundScoring,
  simultaneousAnswers,
  submissionGame,
  submissionJudgeGame,
} from './patterns/gameplay-patterns';
export type { GamePattern } from './patterns/gameplay-patterns';
export {
  classifyMechanism,
  GAMEPLAY_MECHANICS_CATALOG,
  MECHANIC_EXTRACTION_THRESHOLD,
} from './definitions/mechanics-catalog';
export type {
  MechanismAdmission,
  MechanismLayer,
} from './definitions/mechanics-catalog';
export {
  GameSubmissionController,
  GameJudgeController,
  GameVotingController,
  projectSubmissions,
} from './submissions/submission-kit';
export type {
  SubmissionKitState,
  SubmissionPlayerView,
  SubmissionSession,
} from './submissions/submission-kit';
export type {
  GameComponentDefinition,
  GameComponentScope,
  GameInitialization,
  PerPlayerInitialValue,
} from './definitions/component-kit';
export { matchScoped, roundScoped } from './definitions/component-kit';
export {
  countOnly,
  hidden,
  hiddenUntil,
  privateByPlayer,
  privateToOwner,
  projectVisibility,
  publicFields,
  publicField,
} from './kits/visibility-kit';
export type { VisibilityRule } from './kits/visibility-kit';
export {
  cardId,
  pawnId,
  playerId,
  playerMap,
  tileId,
} from './game-identifiers';
export {
  maximizeScore,
  preferAction,
  randomLegalAction,
  weightedLegalAction,
} from './automation/bot-kit';
export type {
  CardId,
  PawnId,
  PlayerId,
  PlayerMap,
  TileId,
} from './game-identifiers';
