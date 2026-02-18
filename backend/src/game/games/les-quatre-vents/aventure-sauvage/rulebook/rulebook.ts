import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePawnId } from '../aventure-sauvage.pawns';
import {
  isRollActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import { requiredString } from '../../../../core/helpers/payload-validators.helper';
import {
  isPendingPawnForPlayer,
  listPendingPawnActions,
  resolvePendingPawnId,
} from '../../../../core/helpers/pawn-selection.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

const GAME_TYPE = 'aventure-sauvage';

function samePlayerId(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const pending = state.pending as any;
  if (pending) {
    if (pending.type === 'draw' && samePlayerId(pending.playerId, playerId)) {
      return [{ type: 'draw', payload: {} }];
    }
    if (
      isPendingPawnForPlayer(pending, playerId, 'choose_pawn')
    ) {
      return listPendingPawnActions(pending, 'choose_pawn');
    }
    return [];
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, playerId)) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  const isRoll = isRollActionType(type);
  if (
    !isRoll &&
    type !== 'draw' &&
    type !== 'choose_pawn'
  ) {
    throw new GameValidationError(`Action inconnue: ${type}`, {
      gameType: GAME_TYPE,
      action: { type },
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', { gameType: GAME_TYPE });
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas demarree.", {
      gameType: GAME_TYPE,
    });
  }
  const pending = state.pending as any;
  if (pending) {
    if (pending.type === 'draw' && samePlayerId(pending.playerId, actorId)) {
      if (type !== 'draw') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      }
      return { type: 'draw', payload: {} };
    }
    if (
      isPendingPawnForPlayer(pending, actorId, 'choose_pawn')
    ) {
      if (type !== 'choose_pawn') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      }
      const pawnId = resolvePendingPawnId(
        pending,
        action.payload ?? {},
        (value) => String(resolvePawnId(value) ?? '').trim(),
      );
      if (!pawnId) {
        throw new GameValidationError('Pion invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      }
      return { type: 'choose_pawn', payload: { pawnId } };
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: GAME_TYPE,
    });
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, actorId)) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: GAME_TYPE,
    });
  }
  return { type: 'roll', payload: {} };
}



