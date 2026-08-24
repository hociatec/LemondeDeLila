import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../application/models/game-action.model';
import {
  isRollAlias,
  normalizeActionType,
} from '../../../../application/helpers/action-service.helper';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../application/helpers/pawn-pending-rulebook.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../domain/errors/public-api';

const ALLOWED = new Set(['roll', 'ROLL_DICE', 'roll_dice', 'choose_pawn']);

type PendingWithPlayer = {
  playerId?: number;
};

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

  const pending = state.pending ?? null;
  if (pending) {
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

  if (!samePlayerId(state.turn?.currentPlayerId ?? null, playerId)) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const normalized = rawType.toLowerCase();
  if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
    throw new GameValidationError(
      `Action type not allowed: ${rawType || '(empty)'}`,
      {
        gameType: 'jeu-oie',
        action: rawType,
        allowedActions: Array.from(ALLOWED),
      },
    );
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameValidationError("La partie n'est pas demarree.", {
      gameType: 'jeu-oie',
      action: rawType,
    });
  }

  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', { gameType: 'jeu-oie' });
  }

  const pending = state.pending ?? null;
  if (pending) {
    const pawnValidation = validatePendingPawnActionForActor({
      pending,
      actorId,
      actionType: normalized,
      payload: action.payload ?? {},
      pendingType: 'choose_pawn',
    });
    if (pawnValidation.ok) {
      return pawnValidation.action;
    }
    if (pawnValidation.reason === 'wrong_action_type') {
      throw new PlayerActionError(
        'Action indisponible (choix de pion requis).',
        { gameType: 'jeu-oie', playerId: actorId },
      );
    }
    if (pawnValidation.reason === 'invalid_pawn') {
      throw new PlayerActionError('Pion invalide.', {
        gameType: 'jeu-oie',
        playerId: actorId,
      });
    }
    throw new PlayerActionError('Action indisponible (choix en attente).', {
      gameType: 'jeu-oie',
      playerId: actorId,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, actorId)) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'jeu-oie',
      playerId: actorId,
        currentPlayerId: current,
      });
  }

  if (isRollAlias(rawType, normalized)) {
    return { ...action, type: 'roll', payload: {} };
  }
  return { ...action, type: 'roll', payload: {} };
}



