import { normalizeActionType } from '../../../../core/application/helpers/action-service.helper';
import { isStartedState } from '../../../../core/application/helpers/rulebook-guard.helper';
import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import {
  GameActorRequiredError,
  GameActionRejectedError,
  GamePayloadValidationError,
  GameStateViolationError,
  GameTurnViolationError,
  GameUnknownActionError,
} from '../../../../core/domain/errors/game-domain.errors';
import type { GameSingleActionDto } from '../../../../core/application/models/game-action.model';
import { DAME_NATURE_CARD_BY_ID } from '../model/dame-nature-cards';
import type { DameNatureMetadata } from '../model/dame-nature-state.model';

export type DameNatureActionType = 'ask_card' | 'pass';

export type DameNatureActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
};

function getMeta(state: GameStateEntity): DameNatureMetadata {
  return (state.metadata ?? {}) as DameNatureMetadata;
}

function getPlayerHand(meta: DameNatureMetadata, playerId: number): string[] {
  return Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
}

function getOpponents(state: GameStateEntity, playerId: number): number[] {
  return (Array.isArray(state.players) ? state.players : [])
    .filter((player) => player?.id != null && player.id !== playerId)
    .map((player) => player.id);
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const opponents = getOpponents(state, playerId);
  const actions: GameSingleActionDto[] = [{ type: 'pass', payload: {} }];

  for (const opponentId of opponents) {
    const hand = getPlayerHand(meta, opponentId);
    for (const cardId of hand) {
      const definition = DAME_NATURE_CARD_BY_ID[cardId];
      if (!definition || definition.type !== 'family') continue;
      actions.push({
        type: 'ask_card',
        payload: { cardId, targetPlayerId: opponentId },
      });
    }
  }

  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  const payload = (action?.payload ?? {}) as DameNatureActionPayload;
  if (type !== 'ask_card' && type !== 'pass') {
    throw new GameUnknownActionError(`Action inconnue : ${type}`);
  }
  if (actorId == null) {
    throw new GameActorRequiredError();
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameStateViolationError("La partie n'est pas commencée.");
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new GameTurnViolationError();
  }

  if (type === 'pass') {
    return { type: 'pass', payload: {} };
  }

  const cardId = String(payload.cardId ?? '').trim();
  if (!cardId) {
    throw new GamePayloadValidationError('Carte manquante.');
  }
  const target = payload.targetPlayerId;
  if (typeof target !== 'number') {
    throw new GamePayloadValidationError('Cible requise.');
  }
  if (target === actorId) {
    throw new GameActionRejectedError('Impossible de demander à soi-même.');
  }

  const meta = getMeta(state);
  const targetHand = getPlayerHand(meta, target);
  if (!targetHand.includes(cardId)) {
    throw new GameActionRejectedError('La cible ne possède pas cette carte.');
  }

  const definition = DAME_NATURE_CARD_BY_ID[cardId];
  if (!definition || definition.type !== 'family') {
    throw new GamePayloadValidationError('Carte invalide pour cette action.');
  }

  return { type: 'ask_card', payload: { cardId, targetPlayerId: target } };
}
