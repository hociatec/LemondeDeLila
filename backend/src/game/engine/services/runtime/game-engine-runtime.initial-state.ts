import type { RoomPayload } from '../../../room/dto/room-response.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../interfaces/game-rules-adapter.interface';

export function buildInitialState(params: {
  payload: RoomPayload;
  gameType: string;
  coreBuildBaseState: (payload: RoomPayload, gameType: string) => GameStateEntity;
  coreAppendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  registryGetHandler: (gameType: string) => GameRulesAdapter | null;
  ensureRandomStarterAtGameStart: (
    baseState: GameStateEntity,
    state: GameStateEntity,
  ) => GameStateEntity;
  appendFirstTurnAnnouncement: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const {
    payload,
    gameType,
    coreBuildBaseState,
    coreAppendLog,
    registryGetHandler,
    ensureRandomStarterAtGameStart,
    appendFirstTurnAnnouncement,
  } = params;

  const baseState = coreBuildBaseState(payload, gameType);
  const status = String(baseState.status ?? '').toLowerCase().trim();
  if (status !== 'started') {
    return baseState;
  }

  const handler = registryGetHandler(gameType);
  if (handler) {
    const hydrated = handler.hydrateInitialState(baseState);
    const randomizedStarter = ensureRandomStarterAtGameStart(baseState, hydrated);
    const withMeta = {
      ...randomizedStarter,
      metadata: {
        ...(randomizedStarter.metadata ?? {}),
        botImmediateStartPending: true,
      },
    } as GameStateEntity;
    return appendFirstTurnAnnouncement(withMeta);
  }

  const logged = coreAppendLog(baseState, `Type de jeu non spécialisé: ${gameType}`);
  const withMeta = {
    ...logged,
    metadata: {
      ...(logged.metadata ?? {}),
      botImmediateStartPending: true,
    },
  } as GameStateEntity;
  return appendFirstTurnAnnouncement(withMeta);
}
