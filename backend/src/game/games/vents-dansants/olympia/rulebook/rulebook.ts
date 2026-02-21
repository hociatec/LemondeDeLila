import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { OlympiaDeckType } from '../model/olympia-cards';
import { normalizeActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
import type {
  OlympiaMetadata,
  OlympiaStatus,
} from '../model/olympia-state.entity';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const actions: GameSingleActionDto[] = [{ type: 'pass', payload: {} }];

  if (hasBlockingStatus(meta.statuses, playerId, 'block_actions')) {
    return actions;
  }

  const decks = Object.entries(meta.decks ?? {})
    .filter(([_, cards]) => Array.isArray(cards) && cards.length > 0)
    .map(([deck]) => deck as OlympiaDeckType);
  for (const deck of decks) {
    actions.push({ type: 'draw_card', payload: { deck } });
  }

  if (hasBlockingStatus(meta.statuses, playerId, 'block_play')) {
    return actions;
  }

  const hand = Array.isArray(meta.hands?.[playerId])
    ? meta.hands[playerId]
    : [];
  for (const cardId of hand) {
    actions.push({
      type: 'play_card',
      payload: { cardId, targetPlayerId: null },
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
    throw new Error("La partie n'est pas ouverte.");
  }
  if (state.turn?.currentPlayerId !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  if (type !== 'draw_card' && type !== 'play_card' && type !== 'pass') {
    throw new Error(`Action inconnue : ${type}`);
  }

  const payload = (action.payload ?? {}) as {
    deck?: OlympiaDeckType | null;
    cardId?: string | null;
  };
  if (type === 'draw_card') {
    const deck = payload.deck ?? 'heros';
    const meta = getMeta(state);
    const available = meta.decks?.[deck] ?? [];
    if (!available.length) {
      throw new Error(`Le deck ${deck} est vide.`);
    }
    if (hasBlockingStatus(meta.statuses, actorId, 'block_actions')) {
      throw new Error('Vous ne pouvez pas piocher.');
    }
    return action;
  }

  if (type === 'play_card') {
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new Error('Carte à jouer manquante.');
    }
    const meta = getMeta(state);
    const hand = Array.isArray(meta.hands?.[actorId])
      ? meta.hands[actorId]
      : [];
    if (!hand.includes(cardId)) {
      throw new Error("Cette carte n'est pas dans votre main.");
    }
    if (hasBlockingStatus(meta.statuses, actorId, 'block_play')) {
      throw new Error('Vous ne pouvez pas jouer de carte.');
    }
    return action;
  }

  return action;
}

function hasBlockingStatus(
  statuses: OlympiaMetadata['statuses'] | undefined,
  playerId: number | undefined,
  key: OlympiaStatus['key'],
): boolean {
  if (!playerId || !statuses) return false;
  const list = statuses[playerId];
  if (!Array.isArray(list)) return false;
  return list.some((status) => status.key === key);
}

function getMeta(state: GameStateEntity): OlympiaMetadata {
  return (state.metadata ?? {}) as OlympiaMetadata;
}
