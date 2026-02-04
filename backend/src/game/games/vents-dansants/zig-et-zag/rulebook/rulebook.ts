import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { ZigEtZagMetadata } from '../model/zig-et-zag-state.entity';

type ZigEtZagActionType = 'play_round';

function getMeta(state: GameStateEntity): ZigEtZagMetadata {
  return (state.metadata ?? {}) as ZigEtZagMetadata;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];
  if (getMeta(state).winnerId != null) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'play_round', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = String(action?.type ?? '').trim();
  if (type !== 'play_round') {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error('La partie n\'est pas démarrée.');
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  if (getMeta(state).winnerId != null) {
    throw new Error('La partie est terminée.');
  }
  return { type: 'play_round', payload: {} };
}
