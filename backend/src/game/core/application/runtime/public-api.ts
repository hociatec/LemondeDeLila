export {
  GAME_SDK_DEPRECATIONS,
  GAME_SDK_VERSION,
  GAME_STATE_MUTATION_POLICY,
} from './game-sdk-version';
export type { GameSdkDeprecation } from './game-sdk-version';

export {
  defineAction,
  defineChoice,
  defineGame,
  gameViewExtension,
  overrideAction,
  playerView,
} from './game-definition';
export type {
  AutomaticRule,
  ChoiceResolver,
  ChoiceResolverShape,
  ChoiceResolution,
  DefinedChoiceResolver,
  DeclarativeGameDefinition,
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
  GamePlayerProjection,
  GameViewExtension,
  GameDefinition,
  GameSession,
  GameStateMigration,
  RawChoiceResolution,
  VictoryRule,
} from './game-definition';
export type {
  GameStatusPlayerView,
  GameSetupPlayerView,
  GamePlayersPlayerView,
  GameEventsPlayerView,
  GameTurnPlayerView,
  GenericBoardPlayerView,
  GenericGamePlayerView,
  MatchPlayerView,
  RoundPlayerView,
  StableGameKitsView,
  StableGameSystemView,
} from './game-system-view';
export { GAME_SYSTEM_VIEW_VERSION } from './game-system-view';
export type {
  DicePlayerView,
  DiceSetPlayerView,
  GameKitsPlayerView,
  MovementPlayerView,
  PawnSetsPlayerView,
} from './game-kit-view';
export {
  boardContent,
  cardContent,
  contentManifest,
  defineGameContent,
  freezeGameContent,
  loadGameContent,
  quizContent,
  trackContent,
} from './game-content';
export type {
  GameContent,
  GameContentManifest,
  GameContentSchema,
  GameContentShape,
  IdentifiedGameContent,
  LinkedBoardContent,
} from './game-content';
export { assertUniqueContentIds } from './game-content';
export { gameInput } from './game-input-schema';
export type { GameInputSchema } from './game-input-schema';
export { defineEvent } from './game-event-definition';
export type { GameEventDefinition } from './game-event-definition';
export { defineSelector, memoizeSelector, selectAll } from './game-selectors';
export type { GameSelector } from './game-selectors';
export {
  defineTieBreaker,
  endConditions,
  endRoundWhen,
  rankWithTieBreakers,
  victoryConditions,
} from './game-end-conditions';
export type {
  GameCondition,
  GameConditionInput,
  GameTieBreaker,
} from './game-end-conditions';
export {
  defineConfiguration,
  GAME_CONFIGURE_ACTION,
} from './configuration-kit';
export type {
  GameConfigurationDefinition,
  GameConfigurationState,
  GameConfigurationUi,
} from './configuration-kit';
export { GameContext } from './game-rule-context';
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
} from './engine-event-registry';
export type {
  EngineEventType,
  EngineEventVisibilityPolicy,
  EventValue,
} from './engine-event-registry';
export {
  createGameSchedulerState,
  GameSchedulerController,
  nextScheduledAction,
  projectScheduler,
} from './scheduler-kit';
export type {
  GameSchedulerState,
  ScheduledGameTask,
  SchedulerVisibility,
} from './scheduler-kit';
export { rejectRule } from '../../domain/errors/game-domain.errors';
export {
  standardTurn,
  clockwise,
  simultaneous,
  actionPoints,
} from './turn-kit';
export type { TurnPolicy } from './turn-kit';
export { commonStatuses } from './player-values-kit';
export type {
  CommonStatusId,
  PlayerStatus,
  PlayerValuesVisibility,
  ScorePlayerView,
  StatusScope,
} from './player-values-kit';
export { overrideComponent, overrideInitialization } from './component-kit';
export { overrideTurn } from './turn-kit';
export { defineGamePhases, phase, setupPlayingPhases } from './phase-kit';
export type {
  GamePhaseId,
  GamePhaseSet,
  PhaseConfiguration,
} from './phase-kit';
export type {
  GameLifecycleHooks,
  RoundLifecycleInput,
  TurnLifecycleInput,
} from './game-lifecycle-hooks';
export { when, victoryWhen } from './automatic-kit';
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
} from './action-conditions';
export type { ActionCondition, ActionValidator } from './action-conditions';
export { cards } from './cards-kit';
export type {
  CardDefinition,
  CardInstance,
  CardZone,
  CardId as KitCardId,
  CardSetsDefinition,
  DeckDefinition,
  HandsDefinition,
} from './cards-kit';
export { inventory } from './inventory-kit';
export type { InventoryDefinition, InventoryKitState } from './inventory-kit';
export { collection } from './collection-view';
export type {
  CollectionPlayerView,
  CollectionValueSource,
  CollectionViewDefinition,
} from './collection-view';
export { economy } from './economy-kit';
export type { EconomyKitState, MarketDefinition } from './economy-kit';
export { ownership } from './ownership-kit';
export type { OwnershipDefinition, OwnershipKitState } from './ownership-kit';
export { GameRankingController } from './ranking-kit';
export type { RankingCriterion, RankingEntry } from './ranking-kit';
export { movement } from './movement-kit';
export type {
  MovementLanding,
  MovementLandingOptions,
  MovementPipelineOptions,
  TrackDefinition,
} from './movement-kit';
export { diceKit } from './dice-kit';
export type {
  DiceDefinition,
  DiceRollPolicy,
  DiceRollResult,
} from './dice-kit';
export { pawns } from './pawn-kit';
export type {
  PawnDefinition,
  PawnKitState,
  PawnMove,
  PawnSetDefinition,
} from './pawn-kit';
export { grid, scanGridWinner } from './grid-kit';
export type { GridDefinition, GridPosition } from './grid-kit';
export { quiz } from './quiz-kit';
export type { QuizDefinition, QuizQuestion } from './quiz-kit';
export { defineEffect, gameEffects } from './effects-kit';
export type {
  EffectEngineState,
  EffectCondition,
  EffectTarget,
  GameEffectInstruction,
  EffectSource,
  GameEffectResolver,
  GameEffectResolverShape,
} from './effects-kit';
export type { EffectEngineDebugSnapshot } from './effect-engine';
export type { SubmissionFlowStage } from './submission-kit';
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
} from './gameplay-recipes';
export type {
  CompleteRoundOptions,
  DrawAndResolveOptions,
  DrawForPlayerOptions,
  EventTrackOptions,
  TileDefinition,
  TileResolutionInput,
  TileResolutionRule,
} from './gameplay-recipes';
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
} from './gameplay-patterns';
export type { GamePattern } from './gameplay-patterns';
export {
  classifyMechanism,
  GAMEPLAY_MECHANICS_CATALOG,
  MECHANIC_EXTRACTION_THRESHOLD,
} from './mechanics-catalog';
export type { MechanismAdmission, MechanismLayer } from './mechanics-catalog';
export {
  GameSubmissionController,
  GameJudgeController,
  GameVotingController,
  projectSubmissions,
} from './submission-kit';
export type {
  SubmissionKitState,
  SubmissionPlayerView,
  SubmissionSession,
} from './submission-kit';
export type {
  GameComponentDefinition,
  GameComponentScope,
  GameInitialization,
  PerPlayerInitialValue,
} from './component-kit';
export { matchScoped, roundScoped } from './component-kit';
export {
  countOnly,
  hidden,
  hiddenUntil,
  privateByPlayer,
  privateToOwner,
  projectVisibility,
  publicFields,
  publicField,
} from './visibility-kit';
export type { VisibilityRule } from './visibility-kit';
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
} from './bot-kit';
export type {
  CardId,
  PawnId,
  PlayerId,
  PlayerMap,
  TileId,
} from './game-identifiers';
