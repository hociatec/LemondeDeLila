import {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../application/models/game-state.model';
import { GameSingleActionDto } from '../../../application/models/game-action.model';
import {
  PanierExpressMetadata,
  PanierExpressPlayer,
  PanierExpressTile,
} from './model/panier-express-state.model';

export function ensurePanierExpressStarted(args: {
  state: GameStateEntity;
  minPlayers: number;
  getPawnText: (player: PlayerStateEntity) => string;
  isBot: (player: PlayerStateEntity) => boolean;
  queuePawnSelection: (state: GameStateEntity) => GameStateEntity;
  assignBotPawns: (state: GameStateEntity) => GameStateEntity;
  finalizeStarterAfterPawnSelection: (
    state: GameStateEntity,
  ) => GameStateEntity;
}): GameStateEntity {
  const status = (args.state.status || '').toLowerCase();
  if (status === 'started' || status !== 'starting') {
    return args.state;
  }

  const players = args.state.players ?? [];
  if (players.length < args.minPlayers) {
    return args.state;
  }

  const needsPawnSelection = players.some(
    (player) => !args.getPawnText(player) && !args.isBot(player),
  );
  if (needsPawnSelection) {
    return args.queuePawnSelection(args.state);
  }

  const withBots = args.assignBotPawns(args.state);
  const readyPlayers = withBots.players ?? [];
  const started: GameStateEntity = {
    ...withBots,
    status: 'started',
    turnIndex: readyPlayers.length ? 0 : -1,
    turn: {
      currentPlayerId: readyPlayers[0]?.id ?? null,
      direction: 1,
    },
  };
  return args.finalizeStarterAfterPawnSelection(started);
}

export function finalizePanierExpressStarterAfterPawnSelection(args: {
  state: GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  nextRandomInt: (
    metadata: PanierExpressMetadata,
    maxExclusive: number,
  ) => { value: number; meta: PanierExpressMetadata };
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  formatCourseLabels: (items: string[]) => string[];
}): GameStateEntity {
  const status = String(args.state.status ?? '').toLowerCase();
  if (status !== 'started' && status !== 'starting') {
    return args.state;
  }

  const players = args.state.players ?? [];
  if (!players.length) {
    return args.state;
  }

  const metadata = args.getMetadata(args.state);
  if (metadata?.starterChosenAfterPawnSelection === true) {
    return args.state;
  }

  const pick = args.nextRandomInt(metadata, players.length);
  const starterIndex = Math.max(0, Math.min(players.length - 1, pick.value));
  const starter = players[starterIndex] ?? players[0];
  const nextMeta = {
    ...metadata,
    ...pick.meta,
    starterChosenAfterPawnSelection: true,
  };

  let next: GameStateEntity = {
    ...args.state,
    turnIndex: starterIndex,
    turn: {
      ...(args.state.turn ?? { direction: 1 }),
      currentPlayerId: starter?.id ?? null,
      direction: 1,
    },
    metadata: {
      ...(args.state.metadata ?? {}),
      ...nextMeta,
    },
  };

  if (typeof starter?.id === 'number') {
    next = args.appendLog(
      next,
      `[Panier Express] Début de partie : ${args.playerName(next, starter.id)} commence.`,
    );
  }

  const metaNow = args.getMetadata(next);
  if (!metaNow.shoppingListAnnouncementsDone) {
    const readyPlayers = next.players ?? [];
    let withLogs = next;
    readyPlayers.forEach((player) => {
      const list = Array.isArray((player as PanierExpressPlayer).shoppingList)
        ? (player as PanierExpressPlayer).shoppingList
        : [];
      if (!list.length) {
        return;
      }

      const listLabel = args.formatCourseLabels(list);
      const label = (player.username ?? '').trim() || 'Joueur ' + player.id;
      withLogs = args.appendLog(
        withLogs,
        '[Panier Express] ' +
          label +
          ' reçoit une liste de courses: ' +
          listLabel.join(', '),
      );
    });

    next = {
      ...withLogs,
      metadata: { ...metaNow, shoppingListAnnouncementsDone: true },
    };
  }

  return next;
}

export function startPanierExpressDrawPending(args: {
  state: GameStateEntity;
  playerId: number;
  data: Record<string, unknown>;
  label: string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  withPending: (
    state: GameStateEntity,
    pending: NonNullable<GameStateEntity['pending']>,
  ) => GameStateEntity;
}): GameStateEntity {
  if (args.state.pending) {
    return args.appendLog(
      args.state,
      `[Panier Express] Une action est déjà en attente.`,
    );
  }

  return args.withPending(args.state, {
    type: 'draw',
    playerId: args.playerId,
    blocking: true,
    label: args.label,
    data: args.data,
  });
}

export function queuePanierExpressCourseDraws(args: {
  state: GameStateEntity;
  tasks: Array<{ playerId: number; standId?: string }>;
  label: string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  withPending: (
    state: GameStateEntity,
    pending: NonNullable<GameStateEntity['pending']>,
  ) => GameStateEntity;
  toDrawQueueEntries: (value: unknown) => Array<{
    playerId: number;
    standId?: string;
  }>;
  asRecord: (value: unknown) => Record<string, unknown>;
}): GameStateEntity {
  const sanitized = args.tasks
    .map((task) => ({
      kind: 'course',
      playerId: Number(task.playerId),
      standId: task.standId,
    }))
    .filter((task) => Number.isFinite(task.playerId));
  if (!sanitized.length) {
    return args.state;
  }

  const pending = args.state.pending;
  if (pending?.type === 'draw' && pending?.data?.kind === 'queue') {
    const pendingData = args.asRecord(pending.data);
    const queue = args.toDrawQueueEntries(pendingData.queue);
    return args.withPending(args.state, {
      ...pending,
      data: {
        ...pendingData,
        kind: 'queue',
        queue: [...queue, ...sanitized],
        cursor: Number(pendingData.cursor ?? 0),
      },
    });
  }

  if (args.state.pending) {
    return args.appendLog(
      args.state,
      `[Panier Express] Une action est déjà en attente.`,
    );
  }

  const first = sanitized[0];
  return args.withPending(args.state, {
    type: 'draw',
    playerId: first.playerId,
    blocking: true,
    label: args.label,
    data: { kind: 'queue', queue: sanitized, cursor: 0 },
  });
}

export function advancePanierExpressAfterDraw(args: {
  state: GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  getAvailableActions: (
    state: GameStateEntity,
    playerId: number,
  ) => GameSingleActionDto[];
  getTurnStatus: (
    state: GameStateEntity,
    playerId: number,
    key: string,
  ) => number;
  clearTurnStatus: (
    state: GameStateEntity,
    playerId: number,
    key: string,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const currentId = args.state.turn?.currentPlayerId ?? null;
  if (currentId == null) {
    return args.state;
  }

  const metadata = args.getMetadata(args.state);
  const postActions = args.getAvailableActions(args.state, currentId);
  const hasBlockingQuiz = Boolean(metadata.quiz.pending[currentId]);
  const hasBlockingPending = Boolean(args.state.pending?.blocking);
  const hasBlockingExchange = postActions.some((action) =>
    ['exchange_choose_target', 'exchange_choose_give'].includes(
      (action.type || '').toLowerCase(),
    ),
  );
  if (hasBlockingQuiz || hasBlockingExchange || hasBlockingPending) {
    return args.state;
  }

  const keepTurn = args.getTurnStatus(args.state, currentId, 'keepTurn');
  if (keepTurn > 0) {
    const cleared = args.clearTurnStatus(args.state, currentId, 'keepTurn');
    return args.appendLog(
      cleared,
      `[Panier Express] ${args.playerName(args.state, currentId)} rejoue (bonus de tour).`,
    );
  }

  const roll =
    typeof args.state.lastRoll === 'number' ? args.state.lastRoll : null;
  const skipTurn = args.getTurnStatus(args.state, currentId, 'skipTurn');
  if (roll === 6 && !(skipTurn > 0)) {
    return args.appendLog(
      args.state,
      `[Panier Express] ${args.playerName(args.state, currentId)} rejoue (sur un 6).`,
    );
  }

  return args.advanceTurn(args.state);
}

export function movePanierExpressPlayer(args: {
  state: GameStateEntity;
  playerId: number;
  roll: number;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  buildTiles: () => PanierExpressTile[];
  moveCircular: (
    length: number,
    currentPosition: number,
    delta: number,
  ) => number;
  tileAt: (
    tiles: PanierExpressTile[],
    index: number,
  ) => PanierExpressTile | undefined;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
}): GameStateEntity {
  const ensured = args.ensureMetadata(args.state);
  const metadata = args.getMetadata(ensured);
  const tiles =
    Array.isArray(metadata.tiles) && metadata.tiles.length
      ? metadata.tiles
      : args.buildTiles();
  const currentPos = metadata.positions[args.playerId] ?? 0;
  const nextPos = args.moveCircular(tiles.length, currentPos, args.roll);
  args.tileAt(tiles, nextPos);

  const laps = { ...(metadata.laps ?? {}) };
  const currentLaps =
    typeof laps[args.playerId] === 'number' ? laps[args.playerId] : 0;
  if (args.roll !== 0 && tiles.length > 0) {
    const wraps = Math.floor((currentPos + args.roll) / tiles.length);
    laps[args.playerId] = Math.max(-1, currentLaps + wraps);
  } else {
    laps[args.playerId] = currentLaps;
  }

  const nextMeta: PanierExpressMetadata = {
    ...metadata,
    positions: { ...metadata.positions, [args.playerId]: nextPos },
    laps,
  };
  const nextState: GameStateEntity = { ...ensured, metadata: nextMeta };
  const abs = Math.abs(args.roll);
  const plural = abs > 1 ? 'cases' : 'case';
  const verb = args.roll < 0 ? 'recule' : 'avance';
  return args.appendLog(
    nextState,
    `${args.playerName(args.state, args.playerId)} ${verb} de ${abs} ${plural}.`,
  );
}
