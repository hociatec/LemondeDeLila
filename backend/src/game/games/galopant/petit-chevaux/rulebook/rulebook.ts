import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  PETIT_CHEVAUX_GAME,
  type PetitChevauxActionType,
} from '../definitions/game.definition';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';

function normalizeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if ((state.status || '').toLowerCase() !== 'started') return [];

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];

  const pending: any = state.pending ?? null;
  if (pending) {
    if (pending.type === 'choose_pawn' && pending.playerId === playerId) {
      const moves: Array<{ pawnIndex: number; targetProgress: number }> =
        Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
      return moves
        .filter(
          (m) =>
            m &&
            typeof m.pawnIndex === 'number' &&
            typeof m.targetProgress === 'number',
        )
        .map((m) => ({
          type: 'move_pawn',
          payload: { pawnIndex: m.pawnIndex, targetProgress: m.targetProgress },
        }));
    }
    return [];
  }

  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = String(action?.type ?? '').trim();
  const normalizedType = rawType.toLowerCase();
  const type = rawType as PetitChevauxActionType;
  if (
    !PETIT_CHEVAUX_GAME.actions.includes(type) &&
    !PETIT_CHEVAUX_GAME.actions.includes(normalizedType as any)
  ) {
    throw new GameValidationError(`Action inconnue: ${rawType}`, {
      gameType: 'petit-chevaux',
      action: rawType,
      allowedActions: PETIT_CHEVAUX_GAME.actions,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'petit-chevaux',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE' || normalizedType === 'roll_dice') {
    return { ...action, type: 'roll', payload: {} };
  }

  if (type === 'roll') {
    return { ...action, type: 'roll', payload: {} };
  }

  if (type === 'move_pawn') {
    const pending: any = state.pending ?? null;
    if (
      !pending ||
      pending.type !== 'choose_pawn' ||
      pending.playerId !== actorId
    ) {
      throw new PlayerActionError('Aucun choix de pion en attente.', {
        gameType: 'petit-chevaux',
        playerId: actorId ?? undefined,
      });
    }

    const payload = action.payload ?? {};
    const pawnIndex = normalizeNumber((payload as any).pawnIndex);
    const targetProgress = normalizeNumber((payload as any).targetProgress);
    if (pawnIndex == null || targetProgress == null) {
      throw new GameValidationError(
        'Payload invalide: pawnIndex/targetProgress',
        {
          gameType: 'petit-chevaux',
          playerId: actorId ?? undefined,
          payload,
        },
      );
    }

    const moves: Array<{ pawnIndex: number; targetProgress: number }> =
      Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
    const ok = moves.some(
      (m) => m?.pawnIndex === pawnIndex && m?.targetProgress === targetProgress,
    );
    if (!ok) {
      throw new GameValidationError('Choix de pion invalide.', {
        gameType: 'petit-chevaux',
        playerId: actorId ?? undefined,
        payload,
      });
    }

    return {
      ...action,
      type: 'move_pawn',
      payload: { pawnIndex, targetProgress },
    };
  }

  return { ...action, type: 'roll', payload: {} };
}
