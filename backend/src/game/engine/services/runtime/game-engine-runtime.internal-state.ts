import type { BadRequestException, NotFoundException } from '@nestjs/common';
import type { RoomPayload } from '../../../../room/dto/room-response.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  RuntimeLogger,
  RuntimeMetadataDeps,
  RuntimeStoreGet,
  RuntimeStoreSet,
} from './game-engine-runtime.deps';

export async function runGetInternalState(params: {
  roomId: number;
  gameType: string;
  roomsGetRoomPayload: (roomId: number) => Promise<RoomPayload>;
  roomsResetRoomSystem: (roomId: number) => Promise<unknown>;
  roomsNotifyRoomStateUpdated: (roomId: number) => Promise<void>;
  storeGet: RuntimeStoreGet;
  storeSet: RuntimeStoreSet;
  storeDelete: (roomId: number, gameType: string) => Promise<void>;
  storeSyncRoomStatus: (state: GameStateEntity, payload: RoomPayload) => GameStateEntity;
  cleanupRoom: (roomId: number, gameType: string) => void;
  isRoomNotFound: (err: unknown) => boolean;
  toMetadata: RuntimeMetadataDeps['toMetadata'];
  normalizeMetadataString: RuntimeMetadataDeps['normalizeMetadataString'];
  parseMetadataNumber: RuntimeMetadataDeps['parseMetadataNumber'];
  forceFinishedIfWinnerDetected: (state: GameStateEntity) => GameStateEntity;
  isWithinFinishedGraceWindow: (state: GameStateEntity) => boolean;
  scheduleFinishedRoomReset: (
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ) => Promise<void>;
  buildInitialState: (payload: RoomPayload, gameType: string) => GameStateEntity;
  markBotThinking: (roomId: number, gameType: string, state: GameStateEntity) => Promise<GameStateEntity>;
  normalizeBotThinking: (roomId: number, gameType: string, state: GameStateEntity) => Promise<GameStateEntity>;
  scheduleBotTurn: (roomId: number, gameType: string, state: GameStateEntity) => Promise<void>;
  syncRosterForStartedRoom: (state: GameStateEntity, payload: RoomPayload) => GameStateEntity;
  gameLogger: Pick<RuntimeLogger, 'warn' | 'error' | 'info' | 'debug'>;
  exceptions: {
    NotFoundException: typeof NotFoundException;
    BadRequestException: typeof BadRequestException;
  };
}): Promise<GameStateEntity> {
  const {
    roomId,
    gameType,
    roomsGetRoomPayload,
    roomsResetRoomSystem,
    roomsNotifyRoomStateUpdated,
    storeGet,
    storeSet,
    storeDelete,
    storeSyncRoomStatus,
    cleanupRoom,
    isRoomNotFound,
    toMetadata,
    normalizeMetadataString,
    parseMetadataNumber,
    forceFinishedIfWinnerDetected,
    isWithinFinishedGraceWindow,
    scheduleFinishedRoomReset,
    buildInitialState,
    markBotThinking,
    normalizeBotThinking,
    scheduleBotTurn,
    syncRosterForStartedRoom,
    gameLogger,
    exceptions,
  } = params;

  let payload: RoomPayload;
  try {
    payload = await roomsGetRoomPayload(roomId);
  } catch (err) {
    cleanupRoom(roomId, gameType);
    if (isRoomNotFound(err)) {
      throw new exceptions.NotFoundException('Table introuvable');
    }
    throw err;
  }

  const actualGameType = String(payload?.room?.gameType ?? '').trim();
  if (actualGameType && actualGameType !== gameType) {
    cleanupRoom(roomId, gameType);
    throw new exceptions.BadRequestException('Type de jeu invalide pour cette table');
  }

  const existing = await storeGet(roomId, gameType);
  if (existing) {
    const metadata = toMetadata(existing);
    const previousStatus = String(existing.status ?? '').toLowerCase();
    const roomStatus = String(payload.room.status ?? '').toLowerCase();
    const storedStartedAt = normalizeMetadataString(metadata['roomStartedAt']);
    const roomStartedAt = normalizeMetadataString(payload.room.startedAt);

    const maybeFinished =
      previousStatus === 'finished' ? existing : forceFinishedIfWinnerDetected(existing);
    const maybeFinishedStatus = String(maybeFinished?.status ?? '').toLowerCase();
    if (roomStatus === 'started' && maybeFinishedStatus === 'finished') {
      if (isWithinFinishedGraceWindow(maybeFinished)) {
        await scheduleFinishedRoomReset(roomId, gameType, maybeFinished);
        return maybeFinished;
      }

      gameLogger.warn(
        'Stale finished game detected while room is started; auto-resetting room',
        { roomId, gameType, previousStatus, roomStatus },
      );

      try {
        await roomsResetRoomSystem(roomId);
      } catch (err) {
        gameLogger.error(
          'Auto-reset room (stale finished) failed',
          err instanceof Error ? err : undefined,
          { roomId, gameType },
        );
      }

      try {
        await storeDelete(roomId, gameType);
      } catch (err) {
        gameLogger.error(
          'Auto-reset game state (stale finished) failed',
          err instanceof Error ? err : undefined,
          { roomId, gameType },
        );
      }

      try {
        await roomsNotifyRoomStateUpdated(roomId);
      } catch {
        // best effort
      }

      try {
        payload = await roomsGetRoomPayload(roomId);
      } catch (err) {
        cleanupRoom(roomId, gameType);
        if (isRoomNotFound(err)) {
          throw new exceptions.NotFoundException('Table introuvable');
        }
        throw err;
      }

      cleanupRoom(roomId, gameType);
      const rebuilt = buildInitialState(payload, gameType);
      const marked = await normalizeBotThinking(
        roomId,
        gameType,
        await markBotThinking(roomId, gameType, rebuilt),
      );
      await scheduleBotTurn(roomId, gameType, marked);
      return marked;
    }

    const storedRunId = parseMetadataNumber(metadata['roomRunId']);
    const roomRunId = parseMetadataNumber(payload.room.runId);
    const hasRunId =
      storedRunId !== null &&
      roomRunId !== null &&
      roomRunId >= 0 &&
      storedRunId >= 0;
    const hasRunIdChanged = hasRunId && storedRunId !== roomRunId;

    const hasMeaningfulStartedAtChange = (() => {
      if (!storedStartedAt || !roomStartedAt) return false;
      const a = Date.parse(storedStartedAt);
      const b = Date.parse(roomStartedAt);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return Math.abs(a - b) > 2000;
      }
      return storedStartedAt !== roomStartedAt;
    })();

    if (
      previousStatus === 'started' &&
      roomStatus &&
      roomStatus !== 'started' &&
      roomStatus !== 'finished'
    ) {
      gameLogger.info('Game state reset detected', {
        roomId,
        gameType,
        previousStatus,
        roomStatus,
      });
      cleanupRoom(roomId, gameType);
      const rebuilt = buildInitialState(payload, gameType);
      const marked = await normalizeBotThinking(
        roomId,
        gameType,
        await markBotThinking(roomId, gameType, rebuilt),
      );
      await scheduleBotTurn(roomId, gameType, marked);
      return marked;
    }

    const synced = storeSyncRoomStatus(existing, payload);
    const withRoster = syncRosterForStartedRoom(synced, payload);
    if (withRoster !== synced) {
      try {
        await storeSet(roomId, gameType, withRoster);
      } catch {
        // best effort
      }
    }

    const nextStatus = String(withRoster.status ?? '').toLowerCase();
    const currentPlayers = existing.players?.length ?? 0;
    const incomingPlayers =
      (payload.room.players?.length ?? 0) + (payload.room.bots?.length ?? 0);
    const gameStarted = (existing.status || '').toLowerCase() === 'started';
    gameLogger.debug('Retrieved game state', {
      roomId,
      gameType,
      status: withRoster.status,
      turnIndex: withRoster.turnIndex,
      currentPlayerId: withRoster.turn?.currentPlayerId ?? null,
      players:
        withRoster.players?.map((p) => ({ id: p.id, isBot: Boolean(p.isBot) })) ??
        [],
      incomingPlayers,
      gameStarted,
    });

    if (previousStatus !== 'started' && nextStatus === 'started') {
      const rebuilt = buildInitialState(payload, gameType);
      const marked = await normalizeBotThinking(
        roomId,
        gameType,
        await markBotThinking(roomId, gameType, rebuilt),
      );
      await scheduleBotTurn(roomId, gameType, marked);
      return marked;
    }

    if (
      previousStatus === 'started' &&
      nextStatus === 'started' &&
      roomStartedAt &&
      storedStartedAt &&
      (hasRunIdChanged || hasMeaningfulStartedAtChange)
    ) {
      gameLogger.info('Game state rebuild (startedAt changed)', {
        roomId,
        gameType,
        storedStartedAt,
        roomStartedAt,
        storedRunId: storedRunId ?? null,
        roomRunId: roomRunId ?? null,
      });
      cleanupRoom(roomId, gameType);
      const rebuilt = buildInitialState(payload, gameType);
      const marked = await normalizeBotThinking(
        roomId,
        gameType,
        await markBotThinking(roomId, gameType, rebuilt),
      );
      await scheduleBotTurn(roomId, gameType, marked);
      return marked;
    }

    if (!gameStarted && incomingPlayers !== currentPlayers) {
      const rebuilt = buildInitialState(payload, gameType);
      const marked = await normalizeBotThinking(
        roomId,
        gameType,
        await markBotThinking(roomId, gameType, rebuilt),
      );
      await scheduleBotTurn(roomId, gameType, marked);
      return marked;
    }

    const normalized = await normalizeBotThinking(roomId, gameType, withRoster);
    const forcedFinished = forceFinishedIfWinnerDetected(normalized);
    if (forcedFinished !== normalized) {
      try {
        await storeSet(roomId, gameType, forcedFinished);
      } catch {
        // best effort
      }
    }
    await scheduleBotTurn(roomId, gameType, forcedFinished);
    return forcedFinished;
  }

  const state = buildInitialState(payload, gameType);
  const marked = await normalizeBotThinking(
    roomId,
    gameType,
    await markBotThinking(roomId, gameType, state),
  );
  await scheduleBotTurn(roomId, gameType, marked);
  return marked;
}
