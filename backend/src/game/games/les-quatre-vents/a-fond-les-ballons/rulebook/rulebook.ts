import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.type === 'swap' && pending.playerId === playerId) {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      return targets.map((t) => ({
        type: 'swap_choose_target',
        payload: { targetPlayerId: t.targetPlayerId },
      }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = String(action?.type ?? '').trim();
  if (
    type !== 'roll' &&
    type !== 'ROLL_DICE' &&
    type !== 'roll_dice' &&
    type !== 'swap_choose_target'
  ) {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error("La partie n'est pas démarrée.");
  }

  const current = state.turn?.currentPlayerId ?? null;

  if (type === 'swap_choose_target') {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'swap' || pending.playerId !== actorId) {
      throw new Error('Aucun échange de position en attente.');
    }
    const targets: Array<{ targetPlayerId: number }> = Array.isArray(pending?.data?.targets)
      ? pending.data.targets
      : [];
    const payload = (action?.payload ?? {}) as any;
    const targetPlayerId =
      typeof payload.targetPlayerId === 'number'
        ? payload.targetPlayerId
        : Number(payload.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) {
      throw new Error('Cible invalide.');
    }
    if (!targets.some((t) => t.targetPlayerId === targetPlayerId)) {
      throw new Error('Cible invalide.');
    }
    return { type: 'swap_choose_target', payload: { targetPlayerId } };
  }

  if (state.pending) {
    throw new Error('Action indisponible (choix en attente).');
  }
  if (current !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  return { type: 'roll', payload: {} };
}

