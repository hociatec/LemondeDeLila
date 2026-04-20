import type {
  GameSingleActionDto,
  GameStateResponse,
} from '../../dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../interfaces/game-rules-adapter.interface';
import type {
  RuntimeBroadcaster,
  RuntimeLogger,
  RuntimeStoreSet,
} from './game-engine-runtime.deps';

export async function runApplyActionsInternal(params: {
  roomId: number;
  gameType: string;
  actions: GameSingleActionDto[];
  actorId: number | null;
  allowBotTurn: boolean;
  botActorIdOverride: number | null;
  getInternalState: (
    roomId: number,
    gameType: string,
  ) => Promise<GameStateEntity>;
  normalizeBotThinking: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<GameStateEntity>;
  registryGetHandler: (gameType: string) => GameRulesAdapter | null;
  validateActions: (
    state: GameStateEntity,
    handler: GameRulesAdapter | null,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ) => Promise<GameSingleActionDto[]>;
  normalizeActionType: (value: unknown) => string;
  isDrawAction: (action: GameSingleActionDto) => boolean;
  isBotTurn: (state: GameStateEntity) => boolean;
  markBotThinking: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    botTurn?: boolean,
  ) => Promise<GameStateEntity>;
  scheduleBotTurn: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<void>;
  botSchedulerClear: (key: string) => void;
  buildKey: (roomId: number, gameType: string) => string;
  exposeState: (state: GameStateEntity, gameType: string) => GameStateResponse;
  broadcastCurrentStateAndExpose: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<GameStateResponse>;
  coreAppendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  storeSet: RuntimeStoreSet;
  normalizeWinnerMetadata: (state: GameStateEntity) => GameStateEntity;
  forceFinishedIfWinnerDetected: (state: GameStateEntity) => GameStateEntity;
  appendBoardArrivalAnnouncements: (
    gameType: string,
    handler: GameRulesAdapter,
    before: GameStateEntity,
    after: GameStateEntity,
  ) => GameStateEntity;
  appendSkipTurnAnnouncements: (state: GameStateEntity) => GameStateEntity;
  toMetadata: (state: { metadata?: unknown }) => Record<string, unknown>;
  deriveFinishedOutcomes: (state: GameStateEntity) => {
    winnerId: number | null;
    outcomesByPlayerId: Record<string, 'won' | 'lost'> | null;
  };
  buildEndgameMessagesByPlayerId: (
    players: unknown[],
  ) => Promise<
    Record<
      string,
      { victoryMessage: string | null; defeatMessage: string | null } | null
    >
  >;
  normalizeUsernameForLog: (username: unknown) => string;
  statsFinalizeFinished: (
    roomId: number,
    state: GameStateEntity,
  ) => Promise<void>;
  buildEndedPayload: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<unknown>;
  endedBroadcaster:
    | ((
        gameType: string,
        roomId: number,
        state: GameStateEntity,
        payload: any,
      ) => void)
    | undefined;
  scheduleFinishedRoomReset: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<void>;
  broadcaster: RuntimeBroadcaster | undefined;
  gameLogger: Required<
    Pick<RuntimeLogger, 'logPlayerAction' | 'debug' | 'error'>
  >;
  exceptions: {
    BadRequestException: new (...args: any[]) => any;
    UnauthorizedException: new (...args: any[]) => any;
  };
}): Promise<GameStateResponse> {
  const {
    roomId,
    gameType,
    actions,
    actorId,
    allowBotTurn,
    botActorIdOverride,
    getInternalState,
    normalizeBotThinking,
    registryGetHandler,
    validateActions,
    normalizeActionType,
    isDrawAction,
    isBotTurn,
    markBotThinking,
    scheduleBotTurn,
    botSchedulerClear,
    buildKey,
    exposeState,
    broadcastCurrentStateAndExpose,
    coreAppendLog,
    storeSet,
    normalizeWinnerMetadata,
    forceFinishedIfWinnerDetected,
    appendBoardArrivalAnnouncements,
    appendSkipTurnAnnouncements,
    toMetadata,
    deriveFinishedOutcomes,
    buildEndgameMessagesByPlayerId,
    normalizeUsernameForLog,
    statsFinalizeFinished,
    buildEndedPayload,
    endedBroadcaster,
    scheduleFinishedRoomReset,
    broadcaster,
    gameLogger,
    exceptions,
  } = params;

  const current = await normalizeBotThinking(
    roomId,
    gameType,
    await getInternalState(roomId, gameType),
  );

  if (Array.isArray(actions) && actions.length > 0) {
    botSchedulerClear(buildKey(roomId, gameType));
  }
  if ((current.status || '').toLowerCase() === 'finished') {
    return exposeState(current, gameType);
  }

  const handler = registryGetHandler(gameType);
  if (!allowBotTurn && (!actorId || Number.isNaN(actorId))) {
    throw new exceptions.UnauthorizedException(
      'Authentification requise pour jouer.',
    );
  }

  const currentPlayerId = current.turn?.currentPlayerId ?? null;
  const currentPlayer = current.players?.find((p) => p.id === currentPlayerId);
  const actingPlayer =
    actorId != null && Number.isFinite(actorId)
      ? (current.players?.find((p) => p.id === actorId) ?? null)
      : null;

  if (!allowBotTurn) {
    if (!actingPlayer || actingPlayer.isBot) {
      throw new exceptions.UnauthorizedException(
        'Mode spectateur : action de jeu interdite',
      );
    }
  }

  const allowOutOfTurnActions = (() => {
    if (allowBotTurn) return false;
    if (!handler?.getAvailableActions) return false;
    if (actorId == null || Number.isNaN(actorId)) return false;
    if (currentPlayerId == null || actorId === currentPlayerId) return false;

    const available = handler.getAvailableActions(current, actorId) ?? [];
    if (!Array.isArray(available) || available.length === 0) return false;

    const allowedTypes = new Set(
      available
        .map((a) => normalizeActionType(a.type))
        .filter((t) => t.length > 0),
    );
    if (allowedTypes.size === 0) return false;

    const requestedTypes = (Array.isArray(actions) ? actions : [])
      .map((a) => normalizeActionType(a.type))
      .filter((t) => t.length > 0);
    if (requestedTypes.length === 0) return false;

    return requestedTypes.every((t) => allowedTypes.has(t));
  })();

  if (!allowBotTurn && current.botThinking && !allowOutOfTurnActions) {
    if (currentPlayer?.isBot) {
      return broadcastCurrentStateAndExpose(roomId, gameType, current);
    }
  }

  const actorOverride =
    allowOutOfTurnActions ||
    handler?.validateActor?.(current, actions, actorId ?? null) === true;
  if (!allowBotTurn && !actorOverride) {
    if (currentPlayer?.isBot) {
      return broadcastCurrentStateAndExpose(roomId, gameType, current);
    }
    if (currentPlayerId !== actorId) {
      return broadcastCurrentStateAndExpose(roomId, gameType, current);
    }
  }

  const botActorId = allowBotTurn
    ? (botActorIdOverride ?? currentPlayerId)
    : null;
  if (allowBotTurn && botActorId == null) {
    throw new exceptions.BadRequestException(
      'Action bot invalide : acteur introuvable.',
    );
  }
  if (allowBotTurn && typeof botActorId === 'number') {
    const bot = current.players?.find((p) => p.id === botActorId) ?? null;
    if (!bot?.isBot) {
      throw new exceptions.BadRequestException('Action bot invalide.');
    }
  }

  const actorLabel = allowBotTurn ? 'bot' : 'human';
  const validatedActions = await validateActions(
    current,
    handler,
    actions,
    allowBotTurn ? botActorId : actorId,
  );
  const sanitizedActions = validatedActions.map((action) => ({
    ...action,
    meta: {
      ...(action?.meta ?? {}),
      actor: actorLabel,
      actorId: allowBotTurn ? botActorId : actorId,
    },
  }));

  gameLogger.logPlayerAction(
    {
      type: 'apply_actions',
      payload: {
        actions: sanitizedActions.map((a) => ({
          type: a.type,
          hasPayload: Boolean(a.payload),
        })),
        allowBotTurn,
      },
    },
    {
      roomId,
      gameType,
      playerId: allowBotTurn
        ? (botActorId ?? undefined)
        : (actorId ?? undefined),
      turnIndex: current.turnIndex,
      action: { status: current.status, currentPlayerId },
    },
  );

  if (!handler) {
    const next = coreAppendLog(
      current,
      `Type de jeu non spécialisé: ${gameType}`,
    );
    const marked = await markBotThinking(roomId, gameType, next);
    await scheduleBotTurn(roomId, gameType, marked);
    broadcaster?.(gameType, roomId, marked);
    return exposeState(marked, gameType);
  }

  const next = handler.applyActions(current, sanitizedActions);
  const botTurn = isBotTurn(next);
  let marked = await markBotThinking(roomId, gameType, next, botTurn);
  const drawAction = sanitizedActions.find((a) => isDrawAction(a));
  if (drawAction) {
    const actionPlayerId = allowBotTurn
      ? (botActorId ?? null)
      : (actorId ?? null);
    marked = {
      ...marked,
      lastDraw: { playerId: actionPlayerId, at: new Date().toISOString() },
    };
  }

  marked = normalizeWinnerMetadata(marked);
  marked = forceFinishedIfWinnerDetected(marked);
  marked = appendBoardArrivalAnnouncements(gameType, handler, current, marked);
  marked = appendSkipTurnAnnouncements(marked);

  if ((marked.status || '').toLowerCase() === 'finished') {
    const metadata = toMetadata(marked);
    const obj = { ...metadata };
    const { winnerId, outcomesByPlayerId } = deriveFinishedOutcomes(marked);

    marked = {
      ...marked,
      metadata: {
        ...obj,
        finishedAt: new Date().toISOString(),
        ...(winnerId != null ? { winnerId, winnerPlayerId: winnerId } : {}),
        ...(outcomesByPlayerId ? { outcomesByPlayerId } : {}),
      },
    };

    try {
      if (outcomesByPlayerId && Object.keys(outcomesByPlayerId).length > 0) {
        const endgameMessagesByPlayerId = await buildEndgameMessagesByPlayerId(
          marked.players ?? [],
        );
        const players = marked.players ?? [];
        const nameById = new Map<number, string>();
        for (const p of players) {
          if (!p || typeof (p as any).id !== 'number') continue;
          const normalized = normalizeUsernameForLog((p as any).username);
          nameById.set((p as any).id, normalized || `Joueur ${(p as any).id}`);
        }

        const log = Array.isArray(marked.log) ? [...marked.log] : [];
        const recent = new Set(
          log.slice(-80).map((e) => String((e as any)?.message ?? '').trim()),
        );
        let nextLog = log;
        for (const [playerIdRaw, outcome] of Object.entries(
          outcomesByPlayerId,
        )) {
          const normalizedOutcome = String(outcome ?? '')
            .trim()
            .toLowerCase();
          if (normalizedOutcome !== 'won' && normalizedOutcome !== 'lost') {
            continue;
          }

          const byPlayer = endgameMessagesByPlayerId[playerIdRaw];
          if (!byPlayer || typeof byPlayer !== 'object') {
            continue;
          }

          const chosen =
            normalizedOutcome === 'won'
              ? byPlayer.victoryMessage
              : byPlayer.defeatMessage;
          if (!chosen) {
            continue;
          }

          const pid = Number(playerIdRaw);
          const name =
            Number.isFinite(pid) && pid > 0
              ? (nameById.get(pid) ?? `Joueur ${pid}`)
              : `Joueur ${playerIdRaw}`;
          const line = `${name} dit: ${chosen}`.trim();
          if (!line || recent.has(line)) {
            continue;
          }

          nextLog = [
            ...nextLog,
            { message: line, timestamp: new Date().toISOString() },
          ];
          recent.add(line);
        }

        if (nextLog !== log) {
          marked = { ...marked, log: nextLog };
        }
      }
    } catch {
      // best effort
    }
  }

  await storeSet(roomId, gameType, marked, { asyncPersist: true });
  await scheduleBotTurn(roomId, gameType, marked);
  broadcaster?.(gameType, roomId, marked);

  if ((marked.status || '').toLowerCase() === 'finished') {
    try {
      await statsFinalizeFinished(roomId, marked);
    } catch (err) {
      gameLogger.error(
        'Finalize finished game failed',
        err instanceof Error ? err : undefined,
        { roomId, gameType },
      );
    }

    try {
      const endedPayload = await buildEndedPayload(roomId, gameType, marked);
      endedBroadcaster?.(gameType, roomId, marked, endedPayload);
    } catch (err) {
      gameLogger.error(
        'Broadcast game.ended failed',
        err instanceof Error ? err : undefined,
        { roomId, gameType },
      );
    }

    try {
      await scheduleFinishedRoomReset(roomId, gameType, marked);
    } catch (err) {
      gameLogger.error(
        'Schedule finished game reset failed',
        err instanceof Error ? err : undefined,
        { roomId, gameType },
      );
    }

    botSchedulerClear(buildKey(roomId, gameType));
  }

  gameLogger.debug('Actions applied successfully', {
    roomId,
    gameType,
    playerId: actorId ?? undefined,
    turnIndex: marked.turnIndex,
    action: {
      status: marked.status,
      currentPlayerId: marked.turn?.currentPlayerId ?? null,
      isBotTurn: botTurn,
      botThinking: (marked as any).botThinking ?? false,
    },
  });

  return exposeState(marked, gameType);
}
