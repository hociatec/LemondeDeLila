import type { CardsPlayerView } from '../cards/cards-kit';
import type { ConfigurationValuesOf } from '../configuration/configuration-kit';
import type {
  GameEventDefinition,
  GameEventMapOf,
} from '../events/game-event-definition';
import type { EngineEventMap } from '../events/engine-event-registry';
import type {
  MatchLifecycleStatus,
  MatchPlayerStatus,
  MatchResult,
} from '../kits/match-kit';
import type { PlayerStatus, ScorePlayerView } from '../kits/player-values-kit';
import type { RoundKitState } from '../kits/round-kit';
import type { SubmissionPlayerView } from '../submissions/submission-kit';
import type { CollectionPlayerView } from './collection-view';
import type {
  DicePlayerView,
  GameKitsPlayerView,
  MovementPlayerView,
  PawnSetsPlayerView,
} from './game-kit-view';

export const GAME_SYSTEM_VIEW_VERSION = 1 as const;

export type MatchPlayerView = {
  status: MatchLifecycleStatus;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  result: MatchResult | null;
  playerStatuses: Record<string, MatchPlayerStatus>;
};

export type RoundPlayerView = {
  number: number;
  status: RoundKitState['status'];
  starterPlayerId: number | null;
  participantPlayerIds: number[];
  leftPlayerIds: number[];
  winnerPlayerIds: number[];
  completedRounds: number;
};

export type StableGameSystemView<TEvents extends object = EngineEventMap> = {
  match: MatchPlayerView;
  round: RoundPlayerView;
  turn: GameTurnPlayerView;
  setup: GameSetupPlayerView;
  players: GamePlayersPlayerView;
  events: GameEventsPlayerView<TEvents>;
};

export type GameEventPlayerView<TType extends string, TData> = {
  /** Stable identity within a committed game-state version. */
  id: string;
  type: TType;
  data: TData;
  actorId: number | null;
  occurredAtMs: number;
};

export type GameEventsPlayerView<TEvents extends object = EngineEventMap> = {
  latestByType: Partial<{
    [TType in keyof TEvents & string]: GameEventPlayerView<
      TType,
      TEvents[TType]
    >;
  }>;
};

export type GamePlayersPlayerView = {
  all: Array<{ id: number; username: string; isBot: boolean; alive: boolean }>;
};

export type StableGameKitsView<
  TResourceId extends string = string,
  TCounterId extends string = string,
> = {
  cards: CardsPlayerView | null;
  movement: MovementPlayerView | null;
  pawns: PawnSetsPlayerView | null;
  grid: NonNullable<GameKitsPlayerView['grid']> | null;
  dice: DicePlayerView | null;
  score: ScorePlayerView;
  resources: Record<string, Partial<Record<TResourceId, number>>>;
  counters: Partial<Record<TCounterId, number>>;
  status: GameStatusPlayerView;
  inventory: GameKitsPlayerView['inventory'] | null;
  economy: GameKitsPlayerView['economy'] | null;
  ownership: GameKitsPlayerView['ownership'] | null;
  quiz: GameKitsPlayerView['quiz'] | null;
  submissions: SubmissionPlayerView;
  collections: CollectionPlayerView;
};

export type GameTurnPlayerView = {
  currentPlayerId: number | null;
  direction: 1 | -1;
  number: number;
  actionPointsRemaining: number | null;
  immediateExtraTurns: number;
  extraCount: number;
  skipTurnsByPlayer: Record<string, number>;
  extraTurnsByPlayer: Record<string, number>;
  replacementTurnsByPlayer: Record<string, number>;
  waitingSessionId: string | null;
  waitingPlayerIds: number[];
};

export type GameSetupPlayerView<
  TValues extends object = Record<string, unknown>,
> = {
  complete: boolean;
  phase: string;
  ownerPlayerId: number | null;
  values: Readonly<TValues>;
};

export type GameSetupPlayerViewFor<TDefinition> = GameSetupPlayerView<
  ConfigurationValuesOf<TDefinition>
>;

export type GenericBoardPlayerView = {
  movement: MovementPlayerView | null;
  pawns: PawnSetsPlayerView | null;
  grid: NonNullable<GameKitsPlayerView['grid']> | null;
};

export type GameStatusPlayerView = {
  byId: Record<string, Record<string, PlayerStatus>>;
};

export type GenericGamePlayerView<
  TEvents extends object = EngineEventMap,
  TResourceId extends string = string,
  TCounterId extends string = string,
> = {
  viewVersion: typeof GAME_SYSTEM_VIEW_VERSION;
  system: StableGameSystemView<TEvents>;
  kits: StableGameKitsView<TResourceId, TCounterId>;
  effect: { source: EffectSourcePlayerView | null };
};

type DefinitionInitialization<TDefinition> = TDefinition extends {
  readonly initialization?: infer TInitialization;
}
  ? TInitialization
  : never;
type PatternInitialization<TDefinition> = TDefinition extends {
  readonly patterns?: infer TPatterns;
}
  ? TPatterns extends readonly (infer TPattern)[]
    ? TPattern extends { readonly initialization?: infer TValue }
      ? TValue
      : never
    : never
  : never;
type AllInitializations<TDefinition> =
  DefinitionInitialization<TDefinition> | PatternInitialization<TDefinition>;
type ResourceIds<TInitialization> = TInitialization extends {
  readonly resources?: infer TResources;
}
  ? string extends keyof NonNullable<TResources>
    ? never
    : Extract<keyof NonNullable<TResources>, string>
  : never;
type CounterIds<TInitialization> = TInitialization extends {
  readonly counters?: infer TCounters;
}
  ? string extends keyof NonNullable<TCounters>
    ? never
    : Extract<keyof NonNullable<TCounters>, string>
  : never;
type DefinitionEvents<TDefinition> = TDefinition extends {
  readonly events?: infer TEvents;
}
  ? TEvents extends readonly GameEventDefinition<string, object>[]
    ? GameEventMapOf<TEvents>
    : Record<never, never>
  : Record<never, never>;

export type GamePlayerViewFor<TDefinition> = GenericGamePlayerView<
  EngineEventMap & DefinitionEvents<TDefinition>,
  ResourceIds<NonNullable<AllInitializations<TDefinition>>>,
  CounterIds<NonNullable<AllInitializations<TDefinition>>>
>;

export type EffectSourcePlayerView = {
  playerId: number | null;
  cardId?: string | number;
  deckId?: string;
  tileId?: string | number;
};
