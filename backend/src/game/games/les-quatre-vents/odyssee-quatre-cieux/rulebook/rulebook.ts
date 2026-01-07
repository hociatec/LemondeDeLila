import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  ODYSSEE_GAME,
  type OdysseeActionType,
} from '../definitions/odyssee.definition';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];
    if (pending.type === 'choose_pawn') {
      const moves: Array<{ pawnIndex: number; targetProgress: number }> =
        Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
      return moves.map((m) => ({
        type: 'move_pawn',
        payload: { pawnIndex: m.pawnIndex, targetProgress: m.targetProgress },
      }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = String(action?.type ?? '').trim();
  const type = (
    rawType === 'roll_dice' ? 'ROLL_DICE' : rawType
  ) as OdysseeActionType;
  if (!ODYSSEE_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'odyssee-quatre-cieux',
      action: rawType,
      allowedActions: ODYSSEE_GAME.actions,
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'odyssee-quatre-cieux',
    });
  if (String(state.status ?? '').toLowerCase() !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'odyssee-quatre-cieux',
    });
  }

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== actorId)
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'odyssee-quatre-cieux',
      });
    if (pending.type !== 'choose_pawn' || type !== 'move_pawn') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'odyssee-quatre-cieux',
      });
    }
    const pawnIndex = Number((action.payload as any)?.pawnIndex);
    const targetProgress = Number((action.payload as any)?.targetProgress);
    if (!Number.isFinite(pawnIndex) || !Number.isFinite(targetProgress)) {
      throw new GameValidationError('Payload invalide.', {
        gameType: 'odyssee-quatre-cieux',
        payload: action.payload,
      });
    }
    const moves: Array<{ pawnIndex: number; targetProgress: number }> =
      Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
    if (
      !moves.some(
        (m) => m.pawnIndex === pawnIndex && m.targetProgress === targetProgress,
      )
    ) {
      throw new GameValidationError('Coup invalide.', {
        gameType: 'odyssee-quatre-cieux',
        pawnIndex,
        targetProgress,
      });
    }
    return { type: 'move_pawn', payload: { pawnIndex, targetProgress } };
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'odyssee-quatre-cieux',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type: 'roll', payload: {} };
}
