import type { TurnStateEntity } from '../models/game-state.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import type { GameConfigurationState } from './configuration-kit';
import type { GameComponentDefinition } from './component-kit';
import type { DeclarativeState } from './game-definition';
import {
  projectGameKits,
  type DicePlayerView,
  type GameKitsPlayerView,
  type MovementPlayerView,
  type PawnSetsPlayerView,
} from './game-kit-view';
import type { CardsPlayerView } from './cards-kit';
import type {
  MatchKitState,
  MatchLifecycleStatus,
  MatchPlayerStatus,
  MatchResult,
} from './match-kit';
import {
  projectPlayerValues,
  projectStatusesByPlayer,
  type PlayerStatus,
  type PlayerValuesVisibility,
  type ScorePlayerView,
} from './player-values-kit';
import type { RoundKitState } from './round-kit';
import type { EffectSource } from './effects-kit';
import {
  projectSubmissions,
  type SubmissionPlayerView,
} from './submission-kit';
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

export type StableGameSystemView = {
  version: typeof GAME_SYSTEM_VIEW_VERSION;
  match: MatchPlayerView;
  round: RoundPlayerView;
  turn: GameTurnPlayerView;
  setup: GameSetupPlayerView;
  players: GamePlayersPlayerView;
  events: GameEventsPlayerView;
};

export type GameEventsPlayerView = {
  latestByType: Record<
    string,
    {
      type: string;
      data: Record<string, unknown>;
      actorId: number | null;
      occurredAtMs: number;
    }
  >;
};

export type GamePlayersPlayerView = {
  all: Array<{ id: number; username: string; isBot: boolean; alive: boolean }>;
  current: {
    id: number;
    username: string;
    isBot: boolean;
    alive: boolean;
  } | null;
};

export type StableGameKitsView = {
  cards: CardsPlayerView | null;
  movement: MovementPlayerView | null;
  pawns: PawnSetsPlayerView | null;
  grid: NonNullable<GameKitsPlayerView['grid']> | null;
  dice: DicePlayerView | null;
  score: ScorePlayerView;
  resources: Record<string, Record<string, number>>;
  counters: Record<string, number>;
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

export type GameSetupPlayerView = {
  complete: boolean;
  phase: string;
  ownerPlayerId: number | null;
  values: Record<string, unknown>;
};

export type GenericBoardPlayerView = {
  movement: MovementPlayerView | null;
  pawns: PawnSetsPlayerView | null;
  grid: NonNullable<GameKitsPlayerView['grid']> | null;
};

export type GameStatusPlayerView = {
  viewer: PlayerStatus[];
  byPlayer: Record<string, PlayerStatus[]>;
  /** Public statuses indexed by status id then player id. */
  byId: Record<string, Record<string, PlayerStatus>>;
};

export type GenericGamePlayerView = {
  viewVersion: typeof GAME_SYSTEM_VIEW_VERSION;
  system: StableGameSystemView;
  kits: StableGameKitsView;
  effect: { source: EffectSource | null };
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
  const players = projectPlayers(runtime.players ?? [], turn.currentPlayerId);
  const events = projectEvents(runtime.engine.pendingEvents ?? []);
  const cards = kits.cards ?? null;
  const dice = kits.dice ?? null;
  const score = values.scoring;
  const status: GameStatusPlayerView = {
    viewer: values.statuses,
    byPlayer: projectStatusesByPlayer(
      runtime.engine.playerValues.statuses,
      viewerPlayerId,
      input.playerValuesVisibility?.statuses,
    ),
    byId: {},
  };
  for (const [playerId, statuses] of Object.entries(status.byPlayer)) {
    for (const playerStatus of statuses) {
      (status.byId[playerStatus.id] ??= {})[playerId] =
        structuredClone(playerStatus);
    }
  }
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
      version: GAME_SYSTEM_VIEW_VERSION,
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
      source: runtime.engine.effects.source
        ? structuredClone(runtime.engine.effects.source)
        : null,
    },
  };
}

function projectEvents(
  events: readonly {
    type: string;
    data: Record<string, unknown>;
    actorId: number | null;
    occurredAtMs: number;
  }[],
): GameEventsPlayerView {
  const latestByType: GameEventsPlayerView['latestByType'] = {};
  for (const event of events) {
    latestByType[event.type] = {
      type: event.type,
      data: structuredClone(event.data),
      actorId: event.actorId,
      occurredAtMs: event.occurredAtMs,
    };
  }
  return { latestByType };
}

function projectPlayers(
  players: readonly PlayerStateEntity[],
  currentPlayerId: number | null,
): GamePlayersPlayerView {
  const all = players.map((player) => ({
    id: player.id,
    username: player.username,
    isBot: player.isBot === true,
    alive: player.alive !== false,
  }));
  return {
    all,
    current: all.find((player) => player.id === currentPlayerId) ?? null,
  };
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
