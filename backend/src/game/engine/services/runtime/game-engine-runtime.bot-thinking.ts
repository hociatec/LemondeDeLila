import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  RuntimeBotActorDeps,
  RuntimeLogger,
  RuntimeStoreSet,
} from './game-engine-runtime.deps';

export async function runMarkBotThinking(params: {
  roomId: number;
  gameType: string;
  state: GameStateEntity;
  botTurn?: boolean;
  runtime: RuntimeBotActorDeps & {
    nowMs: () => number;
    storeMarkBotThinking: (
      state: GameStateEntity,
      isBot: boolean,
    ) => GameStateEntity;
    storeSet: RuntimeStoreSet;
  };
}): Promise<GameStateEntity> {
  const { roomId, gameType, state, botTurn, runtime } = params;
  const handler = runtime.registryGetHandler(gameType);
  // Keep botThinking aligned with an actionable bot to avoid blocking humans.
  const actionableBotId = runtime.getBotActorIdForState(state, handler);
  const isBot = actionableBotId != null || (botTurn === true && !handler);
  const now = runtime.nowMs();
  const marked = {
    ...runtime.storeMarkBotThinking(state, isBot),
    botThinkingSince: isBot ? now : null,
  };
  await runtime.storeSet(roomId, gameType, marked, { asyncPersist: true });
  return marked;
}

export async function runNormalizeBotThinking(params: {
  roomId: number;
  gameType: string;
  state: GameStateEntity;
  botThinkingTtlMs: number;
  runtime: {
    nowMs: () => number;
    storeSet: RuntimeStoreSet;
    gameLogger: RuntimeLogger;
  };
}): Promise<GameStateEntity> {
  const { roomId, gameType, state, botThinkingTtlMs, runtime } = params;
  const since =
    typeof state.botThinkingSince === 'number' ? state.botThinkingSince : null;
  if (!state.botThinking) {
    return state;
  }
  if (since == null) {
    const patched = {
      ...state,
      botThinkingSince: runtime.nowMs(),
    };
    await runtime.storeSet(roomId, gameType, patched, { asyncPersist: true });
    return patched;
  }
  const age = runtime.nowMs() - since;
  if (age <= botThinkingTtlMs) {
    return state;
  }
  runtime.gameLogger.warn('Bot thinking state expired', {
    roomId,
    gameType,
    turnIndex: state.turnIndex,
    action: {
      ageMs: age,
    },
  });
  const cleared = {
    ...state,
    botThinking: false,
    botThinkingSince: null,
  };
  await runtime.storeSet(roomId, gameType, cleared, { asyncPersist: true });
  return cleared;
}

