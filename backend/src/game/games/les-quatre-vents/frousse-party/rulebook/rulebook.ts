import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  FROUSSE_GAME,
  type FrousseActionType,
} from '../definitions/frousse.definition';
import { resolvePawnId } from '../pawns.utils';
import {
  normalizeActionType,
  normalizeLegacyRollAliasToUpper,
  normalizeLowerActionType,
} from '../../../../actions/action-service.helper';
import {
  isPendingPawnForPlayer,
  listPendingPawnActions,
  resolvePendingPawnId,
} from '../../../../core/helpers/pawn-selection.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const toPlayerId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    const pendingPlayerId = toPlayerId(pending.playerId);
    if (pendingPlayerId == null || pendingPlayerId !== playerId) return [];
    if (pending.type === 'draw') {
      return [{ type: 'draw', payload: {} }];
    }
    if (pending.type === 'choose_pawn') {
      return listPendingPawnActions(pending, 'choose_pawn');
    }
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

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current == null || current !== playerId) return [];
  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const toPlayerId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const rawType = normalizeActionType(action);
  const type = normalizeLegacyRollAliasToUpper(rawType) as FrousseActionType;
  if (!FROUSSE_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'frousse-party',
      action: rawType,
      allowedActions: FROUSSE_GAME.actions,
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'frousse-party',
    });
  if (!isStartedState(state)) {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'frousse-party',
    });
  }

  const pending = state.pending as any;
  if (pending) {
    const pendingPlayerId = toPlayerId(pending.playerId);
    if (pendingPlayerId == null || pendingPlayerId !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'frousse-party',
      });
    }
    if (pending.type === 'draw') {
      if (type !== 'draw') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'frousse-party',
        });
      }
      return { type: 'draw', payload: {} };
    }
    if (pending.type === 'choose_pawn') {
      if (type !== 'choose_pawn') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'frousse-party',
        });
      }
      const pawnId = resolvePendingPawnId(
        pending,
        action.payload ?? {},
        (value) => String(resolvePawnId(value) ?? '').trim(),
      );
      if (!pawnId) {
        throw new GameValidationError('Pion invalide.', {
          gameType: 'frousse-party',
          pawnId:
            (action.payload as any)?.pawnId ??
            (action.payload as any)?.pawn ??
            (action.payload as any)?.value ??
            null,
        });
      }
      return { type: 'choose_pawn', payload: { pawnId } };
    }
    if (pending.type === 'choose_target') {
      if (type !== 'choose_target') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'frousse-party',
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
          gameType: 'frousse-party',
          targetPlayerId,
        });
      }
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'frousse-party',
    });
  }

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'frousse-party',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type, payload: action.payload ?? {} };
}




