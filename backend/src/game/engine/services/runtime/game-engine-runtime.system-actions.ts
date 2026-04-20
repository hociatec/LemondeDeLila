import type { GameSingleActionDto } from '../../dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../interfaces/game-rules-adapter.interface';

export async function runApplySystemActions(params: {
  roomId: number;
  gameType: string;
  actions: GameSingleActionDto[];
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
  toMetadata: (state: { metadata?: unknown }) => Record<string, unknown>;
  isBotTurn: (state: GameStateEntity) => boolean;
  markBotThinking: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    botTurn?: boolean,
  ) => Promise<GameStateEntity>;
  normalizeWinnerMetadata: (state: GameStateEntity) => GameStateEntity;
  forceFinishedIfWinnerDetected: (state: GameStateEntity) => GameStateEntity;
  appendBoardArrivalAnnouncements: (
    gameType: string,
    handler: GameRulesAdapter,
    before: GameStateEntity,
    after: GameStateEntity,
  ) => GameStateEntity;
  appendSkipTurnAnnouncements: (state: GameStateEntity) => GameStateEntity;
  storeSet: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    opts?: { asyncPersist?: boolean },
  ) => Promise<void>;
  scheduleBotTurn: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<void>;
  broadcaster:
    | ((gameType: string, roomId: number, state: GameStateEntity) => void)
    | undefined;
}): Promise<void> {
  const {
    roomId,
    gameType,
    actions,
    getInternalState,
    normalizeBotThinking,
    registryGetHandler,
    toMetadata,
    isBotTurn,
    markBotThinking,
    normalizeWinnerMetadata,
    forceFinishedIfWinnerDetected,
    appendBoardArrivalAnnouncements,
    appendSkipTurnAnnouncements,
    storeSet,
    scheduleBotTurn,
    broadcaster,
  } = params;

  const current = await normalizeBotThinking(
    roomId,
    gameType,
    await getInternalState(roomId, gameType),
  );
  if ((current.status || '').toLowerCase() === 'finished') {
    return;
  }

  const handler = registryGetHandler(gameType);
  if (!handler) {
    return;
  }

  const meta = toMetadata(current);
  const fallbackActorId =
    typeof meta['ownerPlayerId'] === 'number'
      ? meta['ownerPlayerId']
      : (current.turn?.currentPlayerId ?? current.players?.[0]?.id ?? null);

  const sanitizedActions = (Array.isArray(actions) ? actions : []).map(
    (action) => ({
      ...action,
      meta: {
        ...(action?.meta ?? {}),
        actor: 'system',
        actorId: fallbackActorId,
      },
    }),
  );

  const next = handler.applyActions(current, sanitizedActions);
  const botTurn = isBotTurn(next);
  let marked = await markBotThinking(roomId, gameType, next, botTurn);
  marked = normalizeWinnerMetadata(marked);
  marked = forceFinishedIfWinnerDetected(marked);
  marked = appendBoardArrivalAnnouncements(gameType, handler, current, marked);
  marked = appendSkipTurnAnnouncements(marked);
  await storeSet(roomId, gameType, marked, { asyncPersist: true });

  await scheduleBotTurn(roomId, gameType, marked);
  broadcaster?.(gameType, roomId, marked);
}
