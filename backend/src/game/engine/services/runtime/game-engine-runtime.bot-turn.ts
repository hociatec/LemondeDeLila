import type {
  GameStateWithActions,
  GameSingleActionDto,
} from '../../dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../interfaces/game-rules-adapter.interface';

export async function runPlayBotTurnInternal(params: {
  roomId: number;
  gameType: string;
  getInternalState: (
    roomId: number,
    gameType: string,
  ) => Promise<GameStateEntity>;
  normalizeBotThinking: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<GameStateEntity>;
  buildKey: (roomId: number, gameType: string) => string;
  botSchedulerClear: (key: string) => void;
  registryGetHandler: (gameType: string) => GameRulesAdapter | null;
  getBotActorIdForState: (
    state: GameStateEntity,
    handler: GameRulesAdapter | null,
  ) => number | null;
  appendFirstTurnAnnouncement: (state: GameStateEntity) => GameStateEntity;
  botRunner: {
    suggestForHandler: (
      handler: GameRulesAdapter | null,
      state: GameStateEntity,
      botActorId: number,
    ) => GameSingleActionDto[] | null;
    choose: (
      actions: GameSingleActionDto[],
      ctx: { state: GameStateEntity; playerId: number },
    ) => GameSingleActionDto[];
  };
  applyActionsInternal: (
    roomId: number,
    gameType: string,
    actions: GameSingleActionDto[],
    actorId: number | null,
    allowBotTurn: boolean,
    botActorIdOverride: number | null,
  ) => Promise<unknown>;
  storeGet: (
    roomId: number,
    gameType: string,
  ) => Promise<GameStateEntity | null>;
  exposeState: (
    state: GameStateEntity,
    gameType: string,
  ) => GameStateWithActions;
  markBotThinking: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    botTurn?: boolean,
  ) => Promise<GameStateEntity>;
  broadcaster:
    | ((gameType: string, roomId: number, state: GameStateEntity) => void)
    | undefined;
  gameLogger: {
    debug: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    logPlayerAction: (...args: any[]) => void;
  };
}): Promise<GameStateWithActions> {
  const {
    roomId,
    gameType,
    getInternalState,
    normalizeBotThinking,
    buildKey,
    botSchedulerClear,
    registryGetHandler,
    getBotActorIdForState,
    appendFirstTurnAnnouncement,
    botRunner,
    applyActionsInternal,
    storeGet,
    exposeState,
    markBotThinking,
    broadcaster,
    gameLogger,
  } = params;

  gameLogger.debug('Bot turn tick', { roomId, gameType });
  let state = await normalizeBotThinking(
    roomId,
    gameType,
    await getInternalState(roomId, gameType),
  );
  const key = buildKey(roomId, gameType);
  botSchedulerClear(key);

  const handler = registryGetHandler(gameType);
  const botActorId = getBotActorIdForState(state, handler);
  const botPlayer =
    botActorId != null ? state.players?.find((p) => p.id === botActorId) : null;

  if (!botPlayer || !botPlayer.isBot || botActorId == null) {
    return exposeState(state, gameType);
  }

  state = appendFirstTurnAnnouncement(state);

  let botActions = botRunner.suggestForHandler(handler, state, botActorId);
  if (!botActions || botActions.length === 0) {
    const fallback = handler?.getAvailableActions
      ? handler.getAvailableActions(state, botActorId)
      : [];
    if (Array.isArray(fallback) && fallback.length > 0) {
      botActions = botRunner.choose(fallback, { state, playerId: botActorId });
    }
  }

  if (!botActions || botActions.length === 0) {
    gameLogger.warn('Bot has no available actions', {
      roomId,
      gameType,
      playerId: botActorId ?? undefined,
      action: { status: state.status },
    });
    const marked = await markBotThinking(roomId, gameType, state, false);
    broadcaster?.(gameType, roomId, marked);
    return exposeState(marked, gameType);
  }

  gameLogger.logPlayerAction(
    { type: 'bot_play', payload: { actions: botActions.map((a) => a.type) } },
    {
      roomId,
      gameType,
      playerId: botActorId ?? undefined,
      action: { isBot: botPlayer.isBot, status: state.status },
    },
  );

  await applyActionsInternal(
    roomId,
    gameType,
    botActions,
    null,
    true,
    botActorId,
  );
  const updated = (await storeGet(roomId, gameType)) ?? state;
  return exposeState(updated, gameType);
}
