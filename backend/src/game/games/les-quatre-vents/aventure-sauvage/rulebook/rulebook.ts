import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import { resolvePawnId } from '../aventure-sauvage.pawns';
import {
  isRollActionType,
  normalizeActionType,
} from '../../../../application/helpers/action-service.helper';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../application/helpers/pawn-pending-rulebook.helper';
import {
  getPendingDrawActionsForPlayer,
  validatePendingDrawActionForActor,
} from '../../../../application/helpers/pending-actions-rulebook.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../domain/errors/public-api';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';

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
  const pending = asPendingRecord(state.pending);
  if (pending) {
    const drawActions = getPendingDrawActionsForPlayer(pending, playerId, {
      samePlayer: samePlayerId,
    });
    if (drawActions.length > 0) return drawActions;
    const pawnActions = getPendingPawnActionsForPlayer(
      pending,
      playerId,
      'choose_pawn',
    );
    if (pawnActions.length > 0) {
      return pawnActions;
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
  if (!isRoll && type !== 'draw' && type !== 'choose_pawn') {
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
  const pending = asPendingRecord(state.pending);
  if (pending) {
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId,
      actionType: type,
      samePlayer: samePlayerId,
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    if (
      pending.type === 'draw' &&
      drawValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: GAME_TYPE,
      });
    }
    const pawnValidation = validatePendingPawnActionForActor({
      pending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
      pendingType: 'choose_pawn',
      idResolver: (value) => String(resolvePawnId(value) ?? '').trim(),
    });
    if (pawnValidation.ok) {
      return pawnValidation.action;
    }
    if (pawnValidation.reason === 'wrong_action_type') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: GAME_TYPE,
      });
    }
    if (pawnValidation.reason === 'invalid_pawn') {
      throw new GameValidationError('Pion invalide.', {
        gameType: GAME_TYPE,
        action: { type, payload: action.payload ?? null },
      });
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asPendingRecord(value: unknown): {
  type?: string;
  playerId?: unknown;
  data?: Record<string, unknown>;
} | null {
  if (!value || typeof value !== 'object') return null;
  const record = asRecord(value);
  return {
    type: toText(record.type),
    playerId: record.playerId,
    data: asRecord(record.data),
  };
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}



