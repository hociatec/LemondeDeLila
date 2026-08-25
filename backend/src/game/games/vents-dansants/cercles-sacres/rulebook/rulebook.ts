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
import type { CerclesSacresActionType } from '../definitions/game.definition';
import type { CerclesSacresTheme } from '../model/cercles-sacres-cards';
import { CERCLES_SACRES_CARD_BY_ID } from '../model/cercles-sacres-cards';
import type { CerclesSacresMetadata } from '../model/cercles-sacres-state.model';
import {
  CERCLES_SACRES_HAND_LIMIT,
  CERCLES_SACRES_HAND_MIN,
} from '../model/cercles-sacres-state.model';

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
  const requestedType = normalizeActionType(action);
  const type = requestedType as CerclesSacresActionType;
  const payload = (action?.payload ?? {}) as CerclesSacresActionPayload;
  if (type !== 'form_circle' && type !== 'discard_card' && type !== 'pass') {
    throw new GameUnknownActionError(
      `Action inconnue: ${requestedType ?? 'unknown'}`,
    );
  }
  if (actorId == null) {
    throw new GameActorRequiredError('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameStateViolationError("La partie n'est pas démarrée.");
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new GameTurnViolationError();
  }

  const meta = getMeta(state);
  const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];

  if (type === 'pass') {
    if (isHandOverLimit(meta, actorId)) {
      throw new GameActionRejectedError(
        "Vous devez défausser jusqu'à revenir à 8 cartes.",
      );
    }
    return { type: 'pass', payload: {} };
  }

  if (type === 'discard_card') {
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new GamePayloadValidationError('Carte introuvable.');
    }
    if (!hand.includes(cardId)) {
      throw new GameActionRejectedError('Carte indisponible.');
    }
    return { type: 'discard_card', payload: { cardId } };
  }

  if (isHandOverLimit(meta, actorId)) {
    throw new GameActionRejectedError(
      'Réduisez votre main avant de former un cercle.',
    );
  }
  const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds : [];
  if (cardIds.length !== 6) {
    throw new GamePayloadValidationError('Un cercle nécessite six cartes.');
  }
  const unique = new Set(cardIds);
  if (unique.size !== 6) {
    throw new GamePayloadValidationError(
      'Chaque carte du cercle doit être unique.',
    );
  }
  for (const cardId of cardIds) {
    if (!hand.includes(cardId)) {
      throw new GameActionRejectedError(
        'Vous ne possédez pas toutes les cartes demandées.',
      );
    }
    if (!CERCLES_SACRES_CARD_BY_ID[cardId]) {
      throw new GamePayloadValidationError(`Carte invalide : ${cardId}`);
    }
  }
  if (!hasCompleteCircle(cardIds)) {
    throw new GamePayloadValidationError(
      'Chaque thème doit être représenté une fois.',
    );
  }
  return { type: 'form_circle', payload: { cardIds } };
}
