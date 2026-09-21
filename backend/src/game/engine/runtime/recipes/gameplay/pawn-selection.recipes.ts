import type { GameContext } from '../../definitions/game-author-context';
import type { PawnDefinition } from '../../kits/pawn-kit';
import { shuffledPlayerIds } from './card-dice.recipes';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';
import {
  assignPawnSelection,
  validatePawnSelectionGroups,
  type PawnSelectionGroup,
} from './pawn-selection-groups';

type SequentialPawnSelectionOptions<TState extends object> = {
  setId: string;
  choiceId: string;
  automatic?: boolean;
  /** Assign bot pawns during setup instead of waiting for realtime automation. */
  automaticBots?: boolean;
  announceRequest?: boolean;
  groups?: readonly PawnSelectionGroup[];
  label?: (pawn: PawnDefinition) => string;
  assigned?: (input: {
    playerId: number;
    pawnId: string;
    ctx: GameContext<TState>;
  }) => void;
  complete?: (input: { ctx: GameContext<TState> }) => void;
  completePhase?: string;
};

type PawnSelectionSetup<TState extends object> = (input: {
  ctx: GameContext<TState>;
  players: ReturnType<GameContext<TState>['players']['all']>;
}) => TState;

type PawnSelectionSetupOptions = {
  order?: 'players' | 'shuffled';
  startRound?: boolean;
};

export function sequentialPawnSelection<TState extends object>(
  options: SequentialPawnSelectionOptions<TState>,
): {
  request: (playerId: number, ctx: GameContext<TState>) => void;
  requestAll: (playerIds: readonly number[], ctx: GameContext<TState>) => void;
  resolve: (playerId: number, pawnId: string, ctx: GameContext<TState>) => void;
  setup: (
    initialState: () => TState,
    options?: PawnSelectionSetupOptions,
  ) => PawnSelectionSetup<TState>;
} {
  options = {
    ...options,
    ...(options.groups
      ? { groups: validatePawnSelectionGroups(options.groups) }
      : {}),
  };
  const request = (playerId: number, ctx: GameContext<TState>): void => {
    orderedPawnSelectionParticipants([playerId], ctx);
    requestPawnSelection(
      options,
      playerId,
      ctx.players.all().map((player) => player.id),
      ctx,
    );
  };
  const requestAll = (
    playerIds: readonly number[],
    ctx: GameContext<TState>,
  ): void => {
    const participants = orderedPawnSelectionParticipants(playerIds, ctx);
    if (options.automatic) {
      for (const playerId of participants) {
        const choice = automaticPawnSelectionChoice(options, ctx);
        assignPawnSelection(
          options.setId,
          choice,
          playerId,
          ctx,
          options.groups,
        );
        options.assigned?.({ playerId, pawnId: choice, ctx });
      }
      completePawnSelection(options, ctx);
      return;
    }
    if (participants.length === 0) {
      completePawnSelection(options, ctx);
      return;
    }
    startPawnSelection(options, participants, ctx);
  };
  const resolve = (
    playerId: number,
    pawnId: string,
    ctx: GameContext<TState>,
  ): void => {
    assignPawnSelection(options.setId, pawnId, playerId, ctx, options.groups);
    options.assigned?.({ playerId, pawnId, ctx });
    const participantIds = pawnSelectionContinuationPlayers(ctx);
    continuePawnSelection(options, participantIds, ctx);
  };
  const setup = (
    initialState: () => TState,
    configuration: PawnSelectionSetupOptions = {},
  ): PawnSelectionSetup<TState> => {
    const { order = 'players', startRound = false } = configuration;
    return ({ players, ctx }) => {
      const ids =
        order === 'shuffled'
          ? shuffledPlayerIds(ctx, players)
          : players.map((player) => player.id);
      if (startRound && ids.length) {
        ctx.round.start(ids[0], ids);
        ctx.turn.to(ids[0]);
      }
      requestAll(ids, ctx);
      return initialState();
    };
  };
  return Object.freeze({ request, requestAll, resolve, setup });
}

function continuePawnSelection<TState extends object>(
  options: SequentialPawnSelectionOptions<TState>,
  participantIds: readonly number[],
  ctx: GameContext<TState>,
): void {
  for (;;) {
    const next = nextPawnSelectionPlayer(options.setId, participantIds, ctx);
    if (!next) {
      completePawnSelection(options, ctx);
      return;
    }
    if (!options.automaticBots || !next.isBot) {
      ctx.turn.to(next.id, { announce: false });
      requestPawnSelection(options, next.id, participantIds, ctx);
      return;
    }
    const choice = automaticPawnSelectionChoice(options, ctx);
    assignPawnSelection(options.setId, choice, next.id, ctx, options.groups);
    options.assigned?.({ playerId: next.id, pawnId: choice, ctx });
  }
}

function startPawnSelection<TState extends object>(
  options: SequentialPawnSelectionOptions<TState>,
  participantIds: readonly number[],
  ctx: GameContext<TState>,
): void {
  const first = participantIds[0];
  if (first == null) {
    completePawnSelection(options, ctx);
    return;
  }
  const player = ctx.players.all().find((candidate) => candidate.id === first);
  if (options.automaticBots && player?.isBot) {
    const choice = automaticPawnSelectionChoice(options, ctx);
    assignPawnSelection(options.setId, choice, first, ctx, options.groups);
    options.assigned?.({ playerId: first, pawnId: choice, ctx });
    continuePawnSelection(options, participantIds, ctx);
    return;
  }
  ctx.turn.to(first, { announce: false });
  requestPawnSelection(options, first, participantIds, ctx);
}

function automaticPawnSelectionChoice<TState extends object>(
  options: SequentialPawnSelectionOptions<TState>,
  ctx: GameContext<TState>,
): string {
  if (options.groups) {
    const available = new Set(
      ctx.pawns.available(options.setId).map((pawn) => pawn.id),
    );
    const group = options.groups.find((candidate) =>
      candidate.pawnIds.every((pawnId) => available.has(pawnId)),
    );
    if (!group) throw new GameRuleViolationError('PAWN_UNAVAILABLE');
    return group.id;
  }
  const pawn = ctx.pawns.available(options.setId)[0];
  if (!pawn) throw new GameRuleViolationError('PAWN_UNAVAILABLE');
  return pawn.id;
}

function completePawnSelection<TState extends object>(
  options: SequentialPawnSelectionOptions<TState>,
  ctx: GameContext<TState>,
): void {
  if (options.completePhase) ctx.phase.transitionTo(options.completePhase);
  const starterId = ctx.round.starter();
  if (options.completePhase && starterId != null) ctx.turn.to(starterId);
  options.complete?.({ ctx });
}

function requestPawnSelection<TState extends object>(
  options: SequentialPawnSelectionOptions<TState>,
  playerId: number,
  playerIds: readonly number[],
  ctx: GameContext<TState>,
): void {
  const available = ctx.pawns.available(options.setId);
  if (options.groups) {
    const ids = new Set(available.map((pawn) => pawn.id));
    const groups = options.groups.filter((group) =>
      group.pawnIds.every((id) => ids.has(id)),
    );
    ctx.choice.one({
      id: options.choiceId,
      player: playerId,
      options: groups.map((group) => group.id),
      label: (id) => groups.find((group) => group.id === id)?.label ?? id,
      // A family assigns the player's complete set of pawns. It is therefore
      // exposed as a pawn workflow just like a single-pawn selection.
      data: { kind: 'pawn', pawnSelectionPlayerIds: [...playerIds] },
    });
    return;
  }
  if (options.announceRequest !== false)
    ctx.events.message('game.pawn.selection-requested', { playerId });
  ctx.choice.pawn({
    id: options.choiceId,
    player: playerId,
    options: available.map((pawn) => pawn.id),
    label: (pawnId) => pawnSelectionLabel(options, available, pawnId),
    data: { pawnSelectionPlayerIds: [...playerIds] },
  });
}

function pawnSelectionLabel<TState extends object>(
  options: SequentialPawnSelectionOptions<TState>,
  available: readonly PawnDefinition[],
  pawnId: string,
): string {
  const pawn = available.find((candidate) => candidate.id === pawnId);
  return pawn
    ? (options.label?.(pawn) ?? pawn.label ?? pawn.name ?? pawn.id)
    : pawnId;
}

function orderedPawnSelectionParticipants<TState extends object>(
  playerIds: readonly number[],
  ctx: GameContext<TState>,
): number[] {
  const uniqueParticipants = [...new Set(playerIds)];
  const playersById = new Map(
    ctx.players.all().map((player) => [player.id, player] as const),
  );
  if (
    uniqueParticipants.some(
      (id) => !Number.isSafeInteger(id) || id === 0 || !playersById.has(id),
    )
  ) {
    throw new GameRuleViolationError('PAWN_SELECTION_PARTICIPANTS_INVALID');
  }
  return [
    ...uniqueParticipants.filter(
      (playerId) => !playersById.get(playerId)?.isBot,
    ),
    ...uniqueParticipants.filter(
      (playerId) => playersById.get(playerId)?.isBot,
    ),
  ];
}

function pawnSelectionContinuationPlayers<TState extends object>(
  ctx: GameContext<TState>,
): number[] {
  const continuation = ctx.choice.continuation<{
    pawnSelectionPlayerIds?: unknown;
  }>();
  const configuredPlayers = continuation?.pawnSelectionPlayerIds;
  return Array.isArray(configuredPlayers)
    ? configuredPlayers.filter(
        (candidate): candidate is number =>
          typeof candidate === 'number' && Number.isInteger(candidate),
      )
    : ctx.players.all().map((player) => player.id);
}

function nextPawnSelectionPlayer<TState extends object>(
  setId: string,
  participantIds: readonly number[],
  ctx: GameContext<TState>,
): ReturnType<GameContext<TState>['players']['all']>[number] | null {
  const playersById = new Map(
    ctx.players.all().map((player) => [player.id, player] as const),
  );
  const nextId = participantIds.find(
    (candidate) =>
      playersById.has(candidate) &&
      ctx.pawns.assigned(setId, candidate).length < ctx.pawns.perPlayer(setId),
  );
  return nextId == null ? null : (playersById.get(nextId) ?? null);
}
