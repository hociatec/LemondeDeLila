import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { PIRATES_GAME } from '../definitions/pirates-en-vadrouille.definition';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];
    if (pending.type === 'choose_target') {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.options,
      )
        ? pending.data.options
        : [];
      return targets.map((t) => ({
        type: 'choose_target',
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
  const rawType = normalizeActionType(action);
  const type =
    rawType === 'ROLL_DICE'
      ? 'roll'
      : rawType === 'roll_dice'
        ? 'roll'
        : (rawType as typeof PIRATES_GAME.actions[number]);
  if (!PIRATES_GAME.actions.includes(type as any)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'pirates-en-vadrouille',
      action: rawType,
      allowedActions: PIRATES_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'pirates-en-vadrouille',
    });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas dÃ©marrÃ©e.", {
      gameType: 'pirates-en-vadrouille',
    });
  }

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'pirates-en-vadrouille',
      });
    }
    if (pending.type === 'choose_target') {
      if (type !== 'choose_target') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'pirates-en-vadrouille',
        });
      }
      const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
      const options: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.options,
      )
        ? pending.data.options
        : [];
      if (
        !Number.isFinite(targetPlayerId) ||
        !options.some((opt) => opt.targetPlayerId === targetPlayerId)
      ) {
        throw new GameValidationError('Cible invalide.', {
          gameType: 'pirates-en-vadrouille',
          targetPlayerId,
        });
      }
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'pirates-en-vadrouille',
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'pirates-en-vadrouille',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'roll') return { type: 'roll', payload: action.payload ?? {} };
  return action;
}



