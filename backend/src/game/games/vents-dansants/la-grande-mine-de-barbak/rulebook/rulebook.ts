import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { LA_GRANDE_MINE_CARD_BY_ID } from '../model/la-grande-mine-cards';
import type { LaGrandeMineMetadata } from '../model/la-grande-mine-state.entity';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const hand = meta.hands?.[playerId] ?? [];
  const actions: GameSingleActionDto[] = [
    {
      type: 'pass',
      payload: {},
    },
  ];
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
    throw new Error('Acteur requis.');
  }
  if (!isStartedState(state)) {
    throw new Error('La partie n\'est pas active.');
  }
  if (state.turn?.currentPlayerId !== actorId) {
    throw new Error('Ce n\'est pas votre tour.');
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
    const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
    if (!hand.includes(cardId)) {
      throw new Error('Cette carte n\'est pas dans votre main.');
    }
    const definition = LA_GRANDE_MINE_CARD_BY_ID[cardId];
    if (!definition) {
      throw new Error('Carte inconnue.');
    }
  }
  return action;
}

function getMeta(state: GameStateEntity): LaGrandeMineMetadata {
  return (state.metadata ?? {}) as LaGrandeMineMetadata;
}



