import type { GameSingleActionDto } from '../../dto/game-action.dto';
import type {
  GameStateEntity,
  PendingState,
} from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../interfaces/game-rules-adapter.interface';
import type {
  RuntimeBroadcaster,
  RuntimeLogger,
  RuntimeMetadataDeps,
  RuntimeStoreGet,
} from './game-engine-runtime.deps';

type BotSchedulerLike = {
  clear: (key: string) => void;
  has: (key: string) => boolean;
  schedule: (params: {
    key: string;
    delayMs: number;
    roomId: number;
    gameType: string;
    run: () => Promise<void>;
    onStale?: () => void;
  }) => void;
};

export async function runScheduleBotTurn(params: {
  roomId: number;
  gameType: string;
  state: GameStateEntity;
  buildKey: (roomId: number, gameType: string) => string;
  buildSystemTimerKey: (
    roomId: number,
    gameType: string,
    suffix: string,
  ) => string;
  toMetadata: RuntimeMetadataDeps['toMetadata'];
  normalizeString: RuntimeMetadataDeps['normalizeMetadataString'];
  parseNumber: RuntimeMetadataDeps['parseMetadataNumber'];
  getMetadataObject: (
    meta: Record<string, unknown>,
    key: string,
  ) => Record<string, unknown> | null;
  registryGetHandler: (gameType: string) => GameRulesAdapter | null;
  getBotActorIdForState: (
    state: GameStateEntity,
    handler: GameRulesAdapter | null,
  ) => number | null;
  pendingSignature: (pending: PendingState | null | undefined) => string | null;
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
  applySystemActions: (
    roomId: number,
    gameType: string,
    actions: GameSingleActionDto[],
  ) => Promise<void>;
  playBotTurn: (roomId: number, gameType: string) => Promise<unknown>;
  storeGet: RuntimeStoreGet;
  broadcaster: RuntimeBroadcaster | undefined;
  cleanupRoom: (roomId: number, gameType: string) => void;
  botSettings: {
    getBotTurnDelayMs: () => number;
    getBotStartDelayMs: () => number;
    getBotDrawDelayMs: () => number;
  };
  botScheduler: BotSchedulerLike;
  nowMs: () => number;
  gameLogger: Pick<RuntimeLogger, 'debug'>;
}): Promise<void> {
  const {
    roomId,
    gameType,
    state,
    buildKey,
    buildSystemTimerKey,
    toMetadata,
    normalizeString,
    parseNumber,
    getMetadataObject,
    registryGetHandler,
    getBotActorIdForState,
    pendingSignature,
    markBotThinking,
    scheduleBotTurn,
    applySystemActions,
    playBotTurn,
    storeGet,
    broadcaster,
    cleanupRoom,
    botSettings,
    botScheduler,
    nowMs,
    gameLogger,
  } = params;

  const key = buildKey(roomId, gameType);
  const systemKey = buildSystemTimerKey(roomId, gameType, 'system');
  const status = (state.status || '').toLowerCase();
  if (
    status === 'finished' ||
    status === 'setup' ||
    status === 'open' ||
    status === 'pending' ||
    status === 'preparing'
  ) {
    botScheduler.clear(key);
    botScheduler.clear(systemKey);
    return;
  }

  // Timed transitions (currently used by LAMA for "pause between rounds").
  if (gameType === 'lama') {
    const lamaMeta = toMetadata(state);
    const step = normalizeString(lamaMeta['step']);
    if (step === 'round_pause') {
      const untilMs = parseNumber(lamaMeta['roundPauseUntilMs']);
      const delayMs = untilMs != null ? Math.max(0, untilMs - nowMs()) : 0;
      botScheduler.clear(key);
      botScheduler.schedule({
        key: systemKey,
        delayMs,
        roomId,
        gameType,
        run: async () => {
          const latest = (await storeGet(roomId, gameType)) ?? null;
          if (!latest) return;
          const latestMeta = toMetadata(latest);
          const latestStep = normalizeString(latestMeta['step']);
          if (latestStep !== 'round_pause') return;
          const latestUntilMs = parseNumber(latestMeta['roundPauseUntilMs']);
          if (
            typeof untilMs === 'number' &&
            latestUntilMs !== null &&
            latestUntilMs !== untilMs
          ) {
            return;
          }
          await applySystemActions(roomId, gameType, [
            { type: 'lama_resume_round', payload: {} },
          ]);
        },
        onStale: () => cleanupRoom(roomId, gameType),
      });
      return;
    }

    // No pause: ensure timer is cleared.
    botScheduler.clear(systemKey);
  }

  // Timed transitions: Arche de Mnemosyne quiz timeout.
  if (gameType === 'arche-de-mnemosyne') {
    const mnemoMeta = toMetadata(state);
    const configMeta = getMetadataObject(mnemoMeta, 'config');
    const useTimer = configMeta?.['useTimer'] === true;
    const untilMs = parseNumber(mnemoMeta['quizDeadlineAtMs']);
    const questionMeta = getMetadataObject(mnemoMeta, 'currentQuestion');
    const questionId =
      questionMeta && typeof questionMeta['id'] === 'string'
        ? questionMeta['id']
        : null;
    const interUntilMs = parseNumber(mnemoMeta['interQuestionUntilMs']);

    if (interUntilMs != null && !questionId) {
      const delayMs = Math.max(0, interUntilMs - nowMs());
      botScheduler.clear(systemKey);
      botScheduler.schedule({
        key: systemKey,
        delayMs,
        roomId,
        gameType,
        run: async () => {
          const latest = (await storeGet(roomId, gameType)) ?? null;
          if (!latest) return;
          const latestMeta = toMetadata(latest);
          const latestQuestionMeta = getMetadataObject(
            latestMeta,
            'currentQuestion',
          );
          if (
            latestQuestionMeta &&
            typeof latestQuestionMeta['id'] === 'string'
          ) {
            return;
          }
          const latestInterUntilMs = parseNumber(
            latestMeta['interQuestionUntilMs'],
          );
          if (latestInterUntilMs === null) return;
          if (latestInterUntilMs !== interUntilMs) return;
          await applySystemActions(roomId, gameType, [
            { type: 'mnemo_timeout', payload: {} },
          ]);
        },
        onStale: () => cleanupRoom(roomId, gameType),
      });
    } else if (useTimer && untilMs != null && questionId) {
      const delayMs = Math.max(0, untilMs - nowMs());
      botScheduler.clear(systemKey);
      botScheduler.schedule({
        key: systemKey,
        delayMs,
        roomId,
        gameType,
        run: async () => {
          const latest = (await storeGet(roomId, gameType)) ?? null;
          if (!latest) return;
          const latestMeta = toMetadata(latest);
          const latestConfigMeta = getMetadataObject(latestMeta, 'config');
          if (latestConfigMeta?.['useTimer'] !== true) return;
          const latestQuestionMeta = getMetadataObject(
            latestMeta,
            'currentQuestion',
          );
          if (
            !latestQuestionMeta ||
            typeof latestQuestionMeta['id'] !== 'string'
          ) {
            return;
          }
          if (latestQuestionMeta['id'] !== questionId) return;
          const latestDeadline = parseNumber(latestMeta['quizDeadlineAtMs']);
          if (latestDeadline !== null && latestDeadline !== untilMs) {
            return;
          }
          await applySystemActions(roomId, gameType, [
            { type: 'mnemo_timeout', payload: {} },
          ]);
        },
        onStale: () => cleanupRoom(roomId, gameType),
      });
    } else {
      botScheduler.clear(systemKey);
    }
  }

  const handler = registryGetHandler(gameType);
  const botActorId = getBotActorIdForState(state, handler);
  const botPlayer =
    botActorId != null
      ? (state.players?.find((p) => p.id === botActorId) ?? null)
      : null;
  if (!botPlayer?.isBot) {
    botScheduler.clear(key);
    return;
  }
  if (botScheduler.has(key)) return;

  const baseDelayMs = botSettings.getBotTurnDelayMs();
  const initialDelayMs = botSettings.getBotStartDelayMs();
  const drawDelayMs = botSettings.getBotDrawDelayMs();
  const meta = toMetadata(state);
  const immediateStart = meta['botImmediateStartPending'] === true;
  const pending = state.pending ?? null;
  const pendingType =
    typeof pending?.type === 'string' ? pending.type.trim().toLowerCase() : '';
  const isQuizPending =
    gameType === 'arche-de-mnemosyne' && (pending as any)?.type === 'quiz';
  const configMeta = getMetadataObject(meta, 'config');
  const quizTimerSeconds =
    isQuizPending &&
    configMeta &&
    typeof configMeta['timerSeconds'] === 'number'
      ? Number(configMeta['timerSeconds'])
      : null;
  const quizTimerMs =
    quizTimerSeconds != null && Number.isFinite(quizTimerSeconds)
      ? Math.max(1, quizTimerSeconds) * 1000
      : null;
  let delayMs = baseDelayMs;
  if (immediateStart) {
    delayMs = initialDelayMs;
  } else if (pendingType === 'draw') {
    delayMs = drawDelayMs;
  }
  if (isQuizPending && quizTimerMs != null) {
    delayMs = Math.min(delayMs, quizTimerMs);
  }
  const stateForSchedule = immediateStart
    ? { ...state, metadata: { ...meta, botImmediateStartPending: false } }
    : state;

  const thinking = await markBotThinking(
    roomId,
    gameType,
    stateForSchedule,
    true,
  );
  broadcaster?.(gameType, roomId, thinking);
  gameLogger.debug('Bot turn scheduled', {
    roomId,
    gameType,
    turnIndex: thinking.turnIndex,
    playerId: botActorId ?? undefined,
    action: { status: thinking.status, delayMs },
  });

  const expectedTurnIndex = thinking.turnIndex ?? null;
  const expectedCurrentPlayerId = thinking.turn?.currentPlayerId ?? null;
  const expectedBotActorId = botActorId ?? null;
  const expectedPendingSig = pendingSignature(thinking.pending);

  botScheduler.schedule({
    key,
    delayMs,
    roomId,
    gameType,
    run: async () => {
      const latest = (await storeGet(roomId, gameType)) ?? null;
      if (!latest) return;
      if ((latest.status || '').toLowerCase() === 'finished') return;
      const latestTurnIndex = latest.turnIndex ?? null;
      const latestCurrentPlayerId = latest.turn?.currentPlayerId ?? null;
      const latestBotActorId = getBotActorIdForState(latest, handler);
      const latestPendingSig = pendingSignature(latest.pending);
      if (
        latestTurnIndex !== expectedTurnIndex ||
        latestCurrentPlayerId !== expectedCurrentPlayerId ||
        latestBotActorId !== expectedBotActorId ||
        latestPendingSig !== expectedPendingSig
      ) {
        gameLogger.debug('Bot turn skipped (stale)', {
          roomId,
          gameType,
          action: {
            expectedTurnIndex,
            latestTurnIndex,
            expectedCurrentPlayerId,
            latestCurrentPlayerId,
            expectedBotActorId,
            latestBotActorId,
          },
        });
        await scheduleBotTurn(roomId, gameType, latest);
        return;
      }
      await playBotTurn(roomId, gameType);
    },
    onStale: () => cleanupRoom(roomId, gameType),
  });
}
