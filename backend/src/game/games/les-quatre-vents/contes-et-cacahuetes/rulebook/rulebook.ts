import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../application/models/game-action.model';
import {
  isRollActionType,
  normalizeActionType,
} from '../../../../application/helpers/action-service.helper';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../application/helpers/pawn-pending-rulebook.helper';
import {
  getPendingCardChoiceActionsForPlayer,
  getPendingChooseTargetActionsForPlayer,
  getPendingDrawActionsForPlayer,
  getPendingNumberChoiceActionsForPlayer,
  getPendingStringChoiceActionsForPlayer,
  validatePendingCardChoiceActionForActor,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
  validatePendingNumberChoiceActionForActor,
  validatePendingStringChoiceActionForActor,
} from '../../../../application/helpers/pending-actions-rulebook.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../domain/errors/public-api';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';

const GAME_TYPE = 'contes-et-cacahuetes';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = asPendingRecord(state.pending);
  if (pending) {
    if (Number(pending.playerId) !== playerId) return [];

    const drawActions = getPendingDrawActionsForPlayer(pending, playerId);
    if (drawActions.length > 0) return drawActions;

    const type = toText(pending.type).toLowerCase();
    if (type === 'choose_pawn') {
      return getPendingPawnActionsForPlayer(pending, playerId, 'choose_pawn');
    }
    if (type === 'reroll') {
      return [
        { type: 'reroll_yes', payload: {} },
        { type: 'reroll_no', payload: {} },
      ];
    }
    const targetActions = getPendingChooseTargetActionsForPlayer(
      pending,
      playerId,
    );
    if (targetActions.length > 0) return targetActions;
    if (type === 'choose_number') {
      return getPendingNumberChoiceActionsForPlayer(pending, playerId, {
        pendingType: 'choose_number',
        actionType: 'choose_number',
        payloadValueKey: 'value',
        minKey: 'min',
        maxKey: 'max',
        defaultMin: 1,
        defaultMax: 3,
      });
    }
    if (type === 'choose_option') {
      return getPendingStringChoiceActionsForPlayer(pending, playerId, {
        pendingType: 'choose_option',
        actionType: 'choose_option',
        payloadOptionKey: 'option',
        choicesContainer: 'root',
        choicesKey: 'choices',
      });
    }
    if (type === 'choose_card') {
      return getPendingCardChoiceActionsForPlayer(pending, playerId, {
        pendingType: 'choose_card',
        actionType: 'choose_card',
        cardsKey: 'cards',
        payloadCardTypeKey: 'cardType',
        payloadCardIdKey: 'cardId',
      });
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
  const type = normalizeActionType(action);
  const isRoll = isRollActionType(type);
  if (
    !isRoll &&
    type !== 'reroll_yes' &&
    type !== 'reroll_no' &&
    type !== 'choose_target' &&
    type !== 'choose_number' &&
    type !== 'choose_option' &&
    type !== 'choose_card' &&
    type !== 'choose_pawn' &&
    type !== 'draw'
  ) {
    throw new GameValidationError(`Action inconnue: ${type}`, {
      gameType: GAME_TYPE,
      action: { type },
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', { gameType: GAME_TYPE });

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started')
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: GAME_TYPE,
    });

  const pending = asPendingRecord(state.pending);
  if (pending) {
    if (Number(pending.playerId) !== actorId)
      throw new PlayerActionError('Action réservée à un autre joueur.', {
        gameType: GAME_TYPE,
      });

    const pType = toText(pending.type).toLowerCase();
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId,
      actionType: type,
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    if (pType === 'draw' && drawValidation.reason === 'wrong_action_type')
      throw new PlayerActionError('Action non disponible.', {
        gameType: GAME_TYPE,
      });

    if (pType === 'choose_pawn') {
      const pawnValidation = validatePendingPawnActionForActor({
        pending,
        actorId,
        actionType: type,
        payload: action.payload ?? {},
        pendingType: 'choose_pawn',
      });
      if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn')
        throw new GameValidationError('Pion invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      if (!pawnValidation.ok)
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      return pawnValidation.action;
    }
    if (pType === 'reroll') {
      if (type !== 'reroll_yes' && type !== 'reroll_no')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      return { type, payload: {} };
    }
    const targetValidation = validatePendingChooseTargetActionForActor({
      pending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
    });
    if (targetValidation.ok) {
      return targetValidation.action;
    }
    if (
      pType === 'choose_target' &&
      targetValidation.reason === 'wrong_action_type'
    )
      throw new PlayerActionError('Action non disponible.', {
        gameType: GAME_TYPE,
      });
    if (
      pType === 'choose_target' &&
      targetValidation.reason === 'invalid_target'
    )
      throw new GameValidationError('Cible invalide.', {
        gameType: GAME_TYPE,
        action: { type, payload: action.payload ?? null },
      });

    if (pType === 'choose_number') {
      const numberValidation = validatePendingNumberChoiceActionForActor({
        pending,
        actorId,
        actionType: type,
        payload: action.payload ?? {},
        pendingType: 'choose_number',
        expectedActionType: 'choose_number',
        payloadValueKey: 'value',
        minKey: 'min',
        maxKey: 'max',
        defaultMin: 1,
        defaultMax: 3,
      });
      if (
        !numberValidation.ok &&
        numberValidation.reason === 'wrong_action_type'
      )
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      if (!numberValidation.ok)
        throw new GameValidationError('Valeur invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      return numberValidation.action;
    }
    if (pType === 'choose_option') {
      const optionValidation = validatePendingStringChoiceActionForActor({
        pending,
        actorId,
        actionType: type,
        payload: action.payload ?? {},
        pendingType: 'choose_option',
        expectedActionType: 'choose_option',
        payloadOptionKey: 'option',
        choicesContainer: 'root',
        choicesKey: 'choices',
      });
      if (
        !optionValidation.ok &&
        optionValidation.reason === 'wrong_action_type'
      )
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      if (!optionValidation.ok)
        throw new GameValidationError('Option invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      return optionValidation.action;
    }
    if (pType === 'choose_card') {
      const cardValidation = validatePendingCardChoiceActionForActor({
        pending,
        actorId,
        actionType: type,
        payload: action.payload ?? {},
        pendingType: 'choose_card',
        expectedActionType: 'choose_card',
        cardsKey: 'cards',
        payloadCardTypeKey: 'cardType',
        payloadCardIdKey: 'cardId',
      });
      if (!cardValidation.ok && cardValidation.reason === 'wrong_action_type')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      if (!cardValidation.ok) {
        throw new GameValidationError('Carte invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      }
      return cardValidation.action;
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: GAME_TYPE,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId)
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: GAME_TYPE,
    });
  return { type: 'roll', payload: {} };
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function asPendingRecord(value: unknown): {
  type?: unknown;
  playerId?: unknown;
} | null {
  if (!value || typeof value !== 'object') return null;
  return value as { type?: unknown; playerId?: unknown };
}




