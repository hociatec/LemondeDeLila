import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  LA_PARADE_CARD_BY_ID,
  LA_PARADE_SEQUENCE,
} from '../model/la-parade-sucree-cards';
import type { LaParadeSucreeMetadata } from '../model/la-parade-sucree-state.entity';
import { normalizeActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) {
    return [];
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const nextValue = LA_PARADE_SEQUENCE[meta.sequenceIndex];
  const hand = Array.isArray(meta.hands?.[playerId])
    ? meta.hands[playerId]
    : [];
  const playable = hand.filter(
    (cardId) => LA_PARADE_CARD_BY_ID[cardId]?.value === nextValue,
  );
  const actions: GameSingleActionDto[] = [{ type: 'pass', payload: {} }];
  for (const cardId of playable) {
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
    throw new Error('Acteur requis.');
  }
  if (!isStartedState(state)) {
    throw new Error("La partie n'est pas active.");
  }
  if (state.turn?.currentPlayerId !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  if (type !== 'play_card' && type !== 'pass') {
    throw new Error(`Action inconnue : ${type}`);
  }
  if (type === 'play_card') {
    const payload = (action.payload ?? {}) as { cardId?: string | null };
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new Error('Carte manquante.');
    }
    const meta = getMeta(state);
    const hand = Array.isArray(meta.hands?.[actorId])
      ? meta.hands[actorId]
      : [];
    if (!hand.includes(cardId)) {
      throw new Error("Cette carte n'est pas dans votre main.");
    }
    const expected = LA_PARADE_SEQUENCE[meta.sequenceIndex];
    const definition = LA_PARADE_CARD_BY_ID[cardId];
    if (!definition || definition.value !== expected) {
      throw new Error("Ce n'est pas la carte attendue.");
    }
  }
  return action;
}

function getMeta(state: GameStateEntity): LaParadeSucreeMetadata {
  return (state.metadata ?? {}) as LaParadeSucreeMetadata;
}
