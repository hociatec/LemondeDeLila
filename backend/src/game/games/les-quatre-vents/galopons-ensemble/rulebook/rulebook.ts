import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  GALOPONS_GAME,
  type GaloponsActionType,
} from '../definitions/galopons.definition';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];
    if (pending.type === 'choose_target') {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
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
  ) as GaloponsActionType;
  if (!GALOPONS_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'galopons-ensemble',
      action: rawType,
      allowedActions: GALOPONS_GAME.actions,
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'galopons-ensemble',
    });

  if (String(state.status ?? '').toLowerCase() !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'galopons-ensemble',
    });
  }

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'galopons-ensemble',
      });
    }
    if (pending.type === 'choose_target') {
      if (type !== 'choose_target') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'galopons-ensemble',
        });
      }
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
        : [];
      const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
      if (
        !Number.isFinite(targetPlayerId) ||
        !targets.some((t) => t.targetPlayerId === targetPlayerId)
      ) {
        throw new GameValidationError('Cible invalide.', {
          gameType: 'galopons-ensemble',
          targetPlayerId,
        });
      }
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'galopons-ensemble',
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'galopons-ensemble',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type, payload: action.payload ?? {} };
}
