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
import { ENTRE_RITES_CARD_BY_ID } from '../model/entre-rites-cards';
import type { EntreRitesMetadata } from '../model/entre-rites-state.model';

type EntreRitesActionType = 'ask_card' | 'pass';

type EntreRitesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
};

function getMeta(state: GameStateEntity): EntreRitesMetadata {
  return (state.metadata ?? {}) as EntreRitesMetadata;
}

function hasFamilyExposure(
  meta: EntreRitesMetadata,
  playerId: number,
  cardId: string,
): boolean {
  const card = ENTRE_RITES_CARD_BY_ID[cardId];
  if (!card || card.type !== 'family') return true;
  const hand = Array.isArray(meta.hands?.[playerId])
    ? meta.hands[playerId]
    : [];
  return hand.some((item) => {
    const definition = ENTRE_RITES_CARD_BY_ID[item];
    return (
      definition?.type === 'family' && definition.familyId === card.familyId
    );
  });
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const peace = meta.peaceTurnsRemaining ?? 0;
  if (peace > 0) {
    return [{ type: 'pass', payload: {} }];
  }
  const actions: GameSingleActionDto[] = [];
  const opponents = (Array.isArray(state.players) ? state.players : [])
    .filter((player) => player?.id != null && player.id !== playerId)
    .map((player) => player.id);

  for (const opponentId of opponents) {
    const opponentHand = Array.isArray(meta.hands?.[opponentId])
      ? meta.hands[opponentId]
      : [];
    for (const cardId of opponentHand) {
      if (!hasFamilyExposure(meta, playerId, cardId)) {
        continue;
      }
      actions.push({
        type: 'ask_card',
        payload: {
          cardId,
          targetPlayerId: opponentId,
        },
      });
    }
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
  const type = requestedType as EntreRitesActionType;
  const payload = (action?.payload ?? {}) as EntreRitesActionPayload;
  if (type !== 'ask_card' && type !== 'pass') {
    throw new GameUnknownActionError(
      `Action inconnue : ${requestedType ?? 'unknown'}`,
    );
  }
  if (actorId == null) {
    throw new GameActorRequiredError();
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameStateViolationError("La partie n’est pas démarrée.");
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new GameTurnViolationError();
  }
  const meta = getMeta(state);
  const peace = meta.peaceTurnsRemaining ?? 0;
  if (type === 'pass') {
    return { type: 'pass', payload: {} };
  }
  if (peace > 0) {
    throw new GameActionRejectedError('La paix impose de passer ce tour.');
  }

  const targetId =
    typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
  const cardId = String(payload.cardId ?? '').trim();
  if (!cardId) {
    throw new GamePayloadValidationError('Carte introuvable.');
  }
  if (targetId == null || targetId === actorId) {
    throw new GamePayloadValidationError('Cible invalide.');
  }
  const targetHand = Array.isArray(meta.hands?.[targetId])
    ? meta.hands[targetId]
    : [];
  if (!targetHand.includes(cardId)) {
    throw new GameActionRejectedError('La cible ne possède pas cette carte.');
  }
  if (!hasFamilyExposure(meta, actorId, cardId)) {
    throw new GameActionRejectedError(
      'Vous devez déjà détenir une carte de cette famille.',
    );
  }

  return { type: 'ask_card', payload: { cardId, targetPlayerId: targetId } };
}
