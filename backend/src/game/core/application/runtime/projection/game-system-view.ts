import type { TurnStateEntity } from '../../models/game-state.model';
import type { PlayerStateEntity } from '../../models/game-state.model';
import type { GameConfigurationState } from '../configuration/configuration-kit';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { DeclarativeState } from '../definitions/game-definition';
import {
  projectGameKits,
  type DicePlayerView,
  type GameKitsPlayerView,
  type MovementPlayerView,
  type PawnSetsPlayerView,
} from './game-kit-view';
import type { CardsPlayerView } from '../cards/cards-kit';
import type {
  MatchKitState,
  MatchLifecycleStatus,
  MatchPlayerStatus,
  MatchResult,
} from '../kits/match-kit';
import {
  projectPlayerValues,
  projectStatusViews,
  type PlayerStatus,
  type PlayerValuesVisibility,
  type ScorePlayerView,
} from '../kits/player-values-kit';
import type { RoundKitState } from '../kits/round-kit';
import type { EffectSource } from '../effects/effects-kit';
import type {
  EventVisibility,
  GamePendingEvent,
} from '../../models/game-event.model';
import type { EngineEventMap } from '../events/engine-event-registry';
import {
  projectSubmissions,
  type SubmissionPlayerView,
} from '../submissions/submission-kit';
import {
  projectCollections,
  type CollectionPlayerView,
  type CollectionViewDefinition,
} from './collection-view';

export const GAME_SYSTEM_VIEW_VERSION = 1 as const;

/** Public match contract, deliberately separate from the persisted kit state. */
export type MatchPlayerView = {
  status: MatchLifecycleStatus;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  result: MatchResult | null;
  playerStatuses: Record<string, MatchPlayerStatus>;
};

/** Public round contract, deliberately separate from the persisted kit state. */
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
  import('../configuration/configuration-kit').ConfigurationValuesOf<TDefinition>
>;

export type GenericBoardPlayerView = {
  movement: MovementPlayerView | null;
  pawns: PawnSetsPlayerView | null;
  grid: NonNullable<GameKitsPlayerView['grid']> | null;
};

export type GameStatusPlayerView = {
  /** Public statuses indexed by status id then player id. */
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

/** Stable public projection; deliberately decoupled from EffectSource internals. */
export type EffectSourcePlayerView = {
  playerId: number | null;
  cardId?: string | number;
  deckId?: string;
  tileId?: string | number;
};

export function projectGameSystemView<TState extends object>(input: {
  runtime: DeclarativeState<TState>;
  viewerPlayerId: number | null;
  components?: readonly GameComponentDefinition[];
  hasConfiguration?: boolean;
  playerValuesVisibility?: PlayerValuesVisibility;
}): GenericGamePlayerView {
  const { runtime, viewerPlayerId } = input;
  const values = projectPlayerValues(
    runtime.engine.playerValues,
    viewerPlayerId,
    input.playerValuesVisibility,
  );
  const kits = projectGameKits(
    runtime.engine.kits,
    viewerPlayerId,
    runtime.turn?.turnNumber ?? 0,
    input.components ?? [],
  );
  const match = projectMatch(runtime.engine.match);
  const turn = projectTurn(
    runtime.turn,
    runtime.engine.playerValues,
    runtime.engine.submissions,
  );
  const round = projectRound(runtime.engine.round);
  const setup = projectSetup(
    runtime.phase,
    runtime.engine.configuration,
    input.hasConfiguration ?? false,
  );
  const players = projectPlayers(runtime.players ?? []);
  const events = projectEventsForPlayer(
    runtime.engine.pendingEvents ?? [],
    viewerPlayerId,
  );
  const cards = kits.cards ?? null;
  const dice = kits.dice ?? null;
  const score = values.scoring;
  const status: GameStatusPlayerView = projectStatusViews(
    runtime.engine.playerValues.statuses,
    viewerPlayerId,
    input.playerValuesVisibility?.statuses,
  );
  const board = {
    movement: kits.movement ?? null,
    pawns: kits.pawns ?? null,
    grid: kits.grid ?? null,
  };
  const collections = projectCollections(
    (input.components ?? []).filter(
      (component): component is CollectionViewDefinition =>
        component.component === 'collection.view',
    ),
    (runtime.players ?? []).map((player) => player.id),
    values,
    kits.inventory ?? null,
  );
  return {
    viewVersion: GAME_SYSTEM_VIEW_VERSION,
    system: {
      match,
      round,
      turn,
      setup,
      players,
      events,
    },
    kits: {
      cards,
      movement: board.movement,
      pawns: board.pawns,
      grid: board.grid,
      dice,
      score,
      resources: values.resources,
      counters: values.counters,
      status,
      inventory: kits.inventory ?? null,
      economy: kits.economy ?? null,
      ownership: kits.ownership ?? null,
      quiz: kits.quiz ?? null,
      submissions: projectSubmissions(
        runtime.engine.submissions,
        viewerPlayerId,
      ),
      collections,
    },
    effect: {
      source: projectEffectSource(runtime.engine.effects.source),
    },
  };
}

export function projectEventsForPlayer(
  events: readonly GamePendingEvent[],
  viewerPlayerId: number | null,
): GameEventsPlayerView<Record<string, Record<string, unknown>>> {
  const latestByType: Record<
    string,
    GameEventPlayerView<string, Record<string, unknown>>
  > = {};
  for (const event of events) {
    const data = projectEventData(event.visibility, event.data, viewerPlayerId);
    if (data == null) continue;
    latestByType[event.type] = {
      type: event.type,
      data,
      actorId: event.actorId,
      occurredAtMs: event.occurredAtMs,
    };
  }
  return { latestByType };
}

function projectEventData(
  visibility: EventVisibility,
  data: Record<string, unknown>,
  viewerPlayerId: number | null,
): Record<string, unknown> | null {
  if (visibility.kind === 'internal') return null;
  if (visibility.kind === 'private') {
    return viewerPlayerId != null &&
      visibility.playerIds.includes(viewerPlayerId)
      ? structuredClone(data)
      : null;
  }
  if (visibility.kind === 'split') {
    const privateData =
      viewerPlayerId == null
        ? undefined
        : visibility.privateDataByPlayer[String(viewerPlayerId)];
    return structuredClone({ ...data, ...(privateData ?? {}) });
  }
  return structuredClone(data);
}

function projectEffectSource(
  source: EffectSource | null | undefined,
): EffectSourcePlayerView | null {
  if (!source) return null;
  return {
    playerId: source.playerId,
    ...(source.cardId == null ? {} : { cardId: source.cardId }),
    ...(source.deckId == null ? {} : { deckId: source.deckId }),
    ...(source.tileId == null ? {} : { tileId: source.tileId }),
  };
}

function projectPlayers(
  players: readonly PlayerStateEntity[],
): GamePlayersPlayerView {
  const all = players.map((player) => ({
    id: player.id,
    username: player.username,
    isBot: player.isBot === true,
    alive: player.alive !== false,
  }));
  return { all };
}

function projectMatch(match: MatchKitState): MatchPlayerView {
  return {
    status: match.status,
    startedAtMs: match.startedAtMs,
    finishedAtMs: match.finishedAtMs,
    result: match.result ? structuredClone(match.result) : null,
    playerStatuses: structuredClone(match.playerStatuses),
  };
}

function projectRound(round: RoundKitState): RoundPlayerView {
  return {
    number: round.number,
    status: round.status,
    starterPlayerId: round.starterPlayerId,
    participantPlayerIds: [...round.participantPlayerIds],
    leftPlayerIds: [...round.leftPlayerIds],
    winnerPlayerIds: [...round.winnerPlayerIds],
    completedRounds: round.completedRounds,
  };
}

function projectTurn(
  turn: TurnStateEntity | undefined,
  values: DeclarativeState<object>['engine']['playerValues'],
  submissions: DeclarativeState<object>['engine']['submissions'],
): GameTurnPlayerView {
  const waitingSessionId = turn?.simultaneousSessionId ?? null;
  const waitingSession = waitingSessionId
    ? submissions.sessions[waitingSessionId]
    : null;
  const currentPlayerId = turn?.currentPlayerId ?? null;
  const immediateExtraTurns = turn?.extraTurns ?? 0;
  return {
    currentPlayerId,
    direction: turn?.direction ?? 1,
    number: turn?.turnNumber ?? 0,
    actionPointsRemaining: turn?.actionPointsRemaining ?? null,
    immediateExtraTurns,
    extraCount:
      immediateExtraTurns +
      (currentPlayerId == null
        ? 0
        : (values.scheduledExtraTurns[String(currentPlayerId)] ?? 0)),
    skipTurnsByPlayer: structuredClone(values.scheduledSkips),
    extraTurnsByPlayer: structuredClone(values.scheduledExtraTurns),
    replacementTurnsByPlayer: structuredClone(
      turn?.scheduledTurnReplacements ?? {},
    ),
    waitingSessionId,
    waitingPlayerIds: waitingSession
      ? waitingSession.participantPlayerIds.filter(
          (playerId) => !(String(playerId) in waitingSession.valuesByPlayerId),
        )
      : [],
  };
}

function projectSetup(
  phase: string,
  configuration: GameConfigurationState,
  hasConfiguration: boolean,
): GameSetupPlayerView {
  return {
    complete:
      phase !== 'setup' && (!hasConfiguration || configuration.complete),
    phase,
    ownerPlayerId: configuration.ownerPlayerId,
    values: structuredClone(configuration.values),
  };
}
