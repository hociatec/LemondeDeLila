import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { CerclesSacresTheme } from '../model/cercles-sacres-cards';
import { CERCLES_SACRES_CARD_BY_ID } from '../model/cercles-sacres-cards';
import type { CerclesSacresMetadata } from '../model/cercles-sacres-state.entity';
import {
  CERCLES_SACRES_HAND_LIMIT,
  CERCLES_SACRES_HAND_MIN,
} from '../model/cercles-sacres-state.entity';
import type { CerclesSacresActionType } from '../definitions/game.definition';
import { normalizeActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

type CerclesSacresActionPayload = {
  cardId?: string | null;
  cardIds?: string[] | null;
};

function getMeta(state: GameStateEntity): CerclesSacresMetadata {
  return (state.metadata ?? {}) as CerclesSacresMetadata;
}

function hasCompleteCircle(cardIds: string[]): boolean {
  const themes = new Set<CerclesSacresTheme>();
  for (const id of cardIds) {
    const definition = CERCLES_SACRES_CARD_BY_ID[id];
    if (!definition) {
      return false;
    }
    themes.add(definition.theme);
  }
  return themes.size === 6;
}

function isHandOverLimit(
  meta: CerclesSacresMetadata,
  playerId: number,
): boolean {
  const hand = meta.hands?.[playerId] ?? [];
  return hand.length > CERCLES_SACRES_HAND_LIMIT;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];

  const meta = getMeta(state);
  const hand = Array.isArray(meta.hands?.[playerId])
    ? [...meta.hands[playerId]]
    : [];
  const actions: GameSingleActionDto[] = [];

  if (!hand.length) {
    if (!isHandOverLimit(meta, playerId)) {
      actions.push({ type: 'pass', payload: {} });
    }
    return actions;
  }

  for (const cardId of hand) {
    actions.push({ type: 'discard_card', payload: { cardId } });
  }

  if (isHandOverLimit(meta, playerId)) {
    return actions;
  }

  if (hand.length >= CERCLES_SACRES_HAND_MIN) {
    actions.push({ type: 'form_circle', payload: {} });
  }
  actions.push({ type: 'pass', payload: {} });

  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action) as CerclesSacresActionType;
  const payload = (action?.payload ?? {}) as CerclesSacresActionPayload;
  if (type !== 'form_circle' && type !== 'discard_card' && type !== 'pass') {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error("La partie n'est pas démarrée.");
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }

  const meta = getMeta(state);
  const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];

  if (type === 'pass') {
    if (isHandOverLimit(meta, actorId)) {
      throw new Error("Vous devez défausser jusqu'à revenir à 8 cartes.");
    }
    return { type: 'pass', payload: {} };
  }

  if (type === 'discard_card') {
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new Error('Carte introuvable.');
    }
    if (!hand.includes(cardId)) {
      throw new Error('Carte indisponible.');
    }
    return { type: 'discard_card', payload: { cardId } };
  }

  if (type === 'form_circle') {
    if (isHandOverLimit(meta, actorId)) {
      throw new Error('Réduisez votre main avant de former un cercle.');
    }
    const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds : [];
    if (cardIds.length !== 6) {
      throw new Error('Un cercle nécessite six cartes.');
    }
    const unique = new Set(cardIds);
    if (unique.size !== 6) {
      throw new Error('Chaque carte du cercle doit être unique.');
    }
    for (const cardId of cardIds) {
      if (!hand.includes(cardId)) {
        throw new Error('Vous ne possédez pas toutes les cartes demandées.');
      }
      if (!CERCLES_SACRES_CARD_BY_ID[cardId]) {
        throw new Error(`Carte invalide : ${cardId}`);
      }
    }
    if (!hasCompleteCircle(cardIds)) {
      throw new Error('Chaque thème doit être représenté une fois.');
    }
    return { type: 'form_circle', payload: { cardIds } };
  }

  throw new Error('Action non supportée.');
}
