import type { TurnStateEntity } from '../../../core/application/contracts/game-state.model';
import type { PlayerStateEntity } from '../../../core/application/contracts/game-state.model';
import type { GameConfigurationState } from '../configuration/configuration-kit';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { DeclarativeState } from '../definitions/game-definition';
import { projectGameKits } from './game-kit-view';
import type { MatchKitState } from '../kits/match-kit';
import {
  projectPlayerValues,
  projectStatusViews,
  type PlayerValuesVisibility,
} from '../kits/player-values-kit';
import type { RoundKitState } from '../kits/round-kit';
import type { EffectSource } from '../effects/effects-kit';
import type { GamePendingEvent } from '../../../core/application/contracts/game-event.model';
import { projectPendingGameEvent } from '../../../core/application/services/game-event-visibility';
import { projectSubmissions } from '../submissions/submission-kit';
import {
  projectCollections,
  type CollectionViewDefinition,
} from './collection-view';
import {
  GAME_SYSTEM_VIEW_VERSION,
  type EffectSourcePlayerView,
  type GameEventPlayerView,
  type GameEventsPlayerView,
  type GamePlayersPlayerView,
  type GameSetupPlayerView,
  type GameStatusPlayerView,
  type GameTurnPlayerView,
  type GenericGamePlayerView,
  type MatchPlayerView,
  type RoundPlayerView,
} from './game-system-view.contracts';
import type { EngineEventMap } from '../events/engine-event-registry';

export * from './game-system-view.contracts';

type GameSystemProjectionInput<TState extends object> = {
  runtime: DeclarativeState<TState>;
  viewerPlayerId: number | null;
  components?: readonly GameComponentDefinition[];
  hasConfiguration?: boolean;
  playerValuesVisibility?: PlayerValuesVisibility;
};

export function projectGameSystemView<
  TState extends object,
  TEvents extends object = EngineEventMap,
>(input: GameSystemProjectionInput<TState>): GenericGamePlayerView<TEvents> {
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
  const events = projectEventsForPlayer<TEvents>(
    runtime.engine.pendingEvents ?? [],
    viewerPlayerId,
    runtime.version ?? 0,
  );
  const cards = kits.cards ?? null;
  const dice = kits.dice ?? null;
  const score = values.scoring;
  const { status, board, collections } = projectExtendedKits(
    input,
    values,
    kits,
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

function projectExtendedKits<TState extends object>(
  input: {
    runtime: DeclarativeState<TState>;
    viewerPlayerId: number | null;
    components?: readonly GameComponentDefinition[];
    playerValuesVisibility?: PlayerValuesVisibility;
  },
  values: ReturnType<typeof projectPlayerValues>,
  kits: ReturnType<typeof projectGameKits>,
) {
  const status: GameStatusPlayerView = projectStatusViews(
    input.runtime.engine.playerValues.statuses,
    input.viewerPlayerId,
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
    (input.runtime.players ?? []).map((player) => player.id),
    values,
    kits.inventory ?? null,
  );
  return { status, board, collections };
}

export function projectEventsForPlayer<TEvents extends object = EngineEventMap>(
  events: readonly GamePendingEvent[],
  viewerPlayerId: number | null,
  stateVersion = 0,
): GameEventsPlayerView<TEvents> {
  const latestByType: Record<string, GameEventPlayerView<string, unknown>> = {};
  for (const [index, event] of events.entries()) {
    const projected = projectPendingGameEvent(event, viewerPlayerId);
    if (projected == null) continue;
    latestByType[event.type] = {
      id: `${stateVersion}:${index}`,
      type: projected.type,
      data: projected.data,
      actorId: projected.actorId,
      occurredAtMs: projected.occurredAtMs,
    };
  }
  // Pending events are persisted through a string-keyed transport boundary;
  // their registry type is restored here after visibility projection.
  return { latestByType } as GameEventsPlayerView<TEvents>;
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
