import { normalizeActionType } from '../../../../application/helpers/action-service.helper';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';
import type { GameStateEntity } from '../../../../application/models/game-state.model';
import {
  GameActorRequiredError,
  GameActionRejectedError,
  GameNotFoundError,
  GamePayloadValidationError,
  GameStateViolationError,
  GameTurnViolationError,
  GameUnknownActionError,
} from '../../../../domain/errors/game-domain.errors';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import { LA_GRANDE_MINE_CARD_BY_ID } from '../model/la-grande-mine-cards';
import type { LaGrandeMineMetadata } from '../model/la-grande-mine-state.model';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const hand = meta.hands?.[playerId] ?? [];
  const actions: GameSingleActionDto[] = [{ type: 'pass', payload: {} }];
  for (const cardId of hand) {
    actions.push({
      type: 'play_card',
      payload: { cardId },
    });
  }
  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  if (!actorId) {
    throw new GameActorRequiredError();
  }
  if (!isStartedState(state)) {
    throw new GameStateViolationError("La partie n'est pas active.");
  }
  if (state.turn?.currentPlayerId !== actorId) {
    throw new GameTurnViolationError();
  }
  if (type !== 'play_card' && type !== 'pass') {
    throw new GameUnknownActionError(`Action inconnue : ${type}`);
  }
  if (type === 'play_card') {
    const payload = (action.payload ?? {}) as { cardId?: string | null };
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new GamePayloadValidationError('Carte manquante.');
    }
    const meta = getMeta(state);
    const hand = Array.isArray(meta.hands?.[actorId])
      ? meta.hands[actorId]
      : [];
    if (!hand.includes(cardId)) {
      throw new GameActionRejectedError("Cette carte n'est pas dans votre main.");
    }
    const definition = LA_GRANDE_MINE_CARD_BY_ID[cardId];
    if (!definition) {
      throw new GameNotFoundError('Carte inconnue.');
    }
  }
  return action;
}

function getMeta(state: GameStateEntity): LaGrandeMineMetadata {
  return (state.metadata ?? {}) as LaGrandeMineMetadata;
}
