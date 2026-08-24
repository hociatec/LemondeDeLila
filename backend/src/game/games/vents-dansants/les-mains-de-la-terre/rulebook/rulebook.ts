import { normalizeActionType } from '../../../../application/helpers/action-service.helper';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';
import type { GameStateEntity } from '../../../../application/models/game-state.model';
import {
  GameActorRequiredError,
  GameActionRejectedError,
  GamePayloadValidationError,
  GameStateViolationError,
  GameTurnViolationError,
  GameUnknownActionError,
} from '../../../../domain/errors/game-domain.errors';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import {
  LES_MAINS_CARD_BY_ID,
  LES_MAINS_FAMILIES,
} from '../model/les-mains-de-la-terre-cards';
import type { LesMainsFamily } from '../model/les-mains-de-la-terre-cards';
import type { LesMainsMetadata } from '../model/les-mains-de-la-terre-state.model';

type LesMainsActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
};

function getMeta(state: GameStateEntity): LesMainsMetadata {
  return (state.metadata ?? {}) as LesMainsMetadata;
}

function getPlayerIds(players?: GameStateEntity['players']): number[] {
  return (Array.isArray(players) ? players : [])
    .filter((player) => typeof player?.id === 'number')
    .map((player) => player.id);
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  if (state.turn?.currentPlayerId !== playerId) return [];
  const meta = getMeta(state);
  if (meta.winnerId != null) return [];
  const freeRequest = Boolean(meta.freeFamilyRequest?.[playerId]);
  const hand = Array.isArray(meta.hands?.[playerId])
    ? meta.hands[playerId]
    : [];
  const ownedFamilies = freeRequest
    ? new Set<LesMainsFamily>(LES_MAINS_FAMILIES)
    : new Set<LesMainsFamily>(
        hand
          .map((cardId) => LES_MAINS_CARD_BY_ID[cardId]?.family)
          .filter((family): family is LesMainsFamily => Boolean(family)),
      );
  const targets = getPlayerIds(state.players).filter((pid) => pid !== playerId);
  const requestedCards = Object.values(LES_MAINS_CARD_BY_ID).filter(
    (card) => card.family && card.type === 'metier',
  );
  const actions: GameSingleActionDto[] = [];
  for (const targetId of targets) {
    for (const card of requestedCards) {
      if (!card.family) continue;
      if (!ownedFamilies.has(card.family)) continue;
      actions.push({
        type: 'request_card',
        payload: { cardId: card.id, targetPlayerId: targetId },
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
  if (type !== 'request_card') {
    throw new GameUnknownActionError(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new GameActorRequiredError('Acteur requis');
  }
  const meta = getMeta(state);
  if (meta.winnerId != null) {
    throw new GameStateViolationError('La partie est terminée.');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameStateViolationError("La partie n'est pas démarrée.");
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new GameTurnViolationError();
  }
  const payload = (action.payload ?? {}) as LesMainsActionPayload;
  const cardId = String(payload.cardId ?? '').trim();
  const target =
    typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
  if (!cardId || target == null || target === actorId) {
    throw new GamePayloadValidationError('Cible ou carte invalide.');
  }
  const definition = LES_MAINS_CARD_BY_ID[cardId];
  if (!definition || definition.type !== 'metier' || !definition.family) {
    throw new GamePayloadValidationError(
      "La carte demandée n'est pas une carte métier valide.",
    );
  }
  const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
  const hasFamily = hand.some(
    (card) => LES_MAINS_CARD_BY_ID[card]?.family === definition.family,
  );
  const freeRequest = Boolean(meta.freeFamilyRequest?.[actorId]);
  if (!hasFamily && !freeRequest) {
    throw new GameActionRejectedError(
      'Vous devez posséder au moins une carte de cette famille pour la demander.',
    );
  }
  const targetExists = getPlayerIds(state.players).includes(target);
  if (!targetExists) {
    throw new GamePayloadValidationError('Joueur cible invalide.');
  }
  return { type: 'request_card', payload: { cardId, targetPlayerId: target } };
}
