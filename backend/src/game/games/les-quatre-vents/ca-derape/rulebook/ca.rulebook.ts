import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../engine/dto/game-action.dto';

export function getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];
    if (pending.type === 'choose_target') {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(pending?.data?.targets) ? pending.data.targets : [];
      return targets.map((t) => ({ type: 'choose_target', payload: { targetPlayerId: t.targetPlayerId } }));
    }
    if (pending.type === 'choose_next_player') {
      const ids: number[] = Array.isArray(pending?.data?.playerIds) ? pending.data.playerIds : [];
      return ids.map((id) => ({ type: 'choose_next_player', payload: { playerId: id } }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto {
  const type = String(action?.type ?? '').trim();
  if (type !== 'roll' && type !== 'ROLL_DICE' && type !== 'roll_dice' && type !== 'choose_target' && type !== 'choose_next_player') {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) throw new Error('Acteur requis');
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') throw new Error("La partie n'est pas démarrée.");

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== actorId) throw new Error('Action réservée à un autre joueur.');
    if (pending.type === 'choose_target') {
      if (type !== 'choose_target') throw new Error('Choix invalide.');
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(pending?.data?.targets) ? pending.data.targets : [];
      const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
      if (!Number.isFinite(targetPlayerId) || !targets.some((t) => t.targetPlayerId === targetPlayerId)) throw new Error('Cible invalide.');
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    if (pending.type === 'choose_next_player') {
      if (type !== 'choose_next_player') throw new Error('Choix invalide.');
      const ids: number[] = Array.isArray(pending?.data?.playerIds) ? pending.data.playerIds : [];
      const playerId = Number((action.payload as any)?.playerId);
      if (!Number.isFinite(playerId) || !ids.includes(playerId)) throw new Error('Joueur invalide.');
      return { type: 'choose_next_player', payload: { playerId } };
    }
    throw new Error('Choix invalide.');
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) throw new Error("Ce n'est pas votre tour.");
  return { type: 'roll', payload: {} };
}

