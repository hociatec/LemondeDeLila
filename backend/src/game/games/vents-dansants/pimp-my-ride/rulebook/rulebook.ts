import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  PIMP_MY_RIDE_CARD_BY_ID,
  PIMP_MY_RIDE_CATEGORY_ORDER,
} from '../model/pimp-my-ride-cards';
import type {
  PimpMyRideMetadata,
  PimpMyRidePlayerProgress,
} from '../model/pimp-my-ride-state.entity';
import { normalizeActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

interface PimpMyRideActionPayload {
  cardId?: string | null;
}

function getMeta(state: GameStateEntity): PimpMyRideMetadata {
  return (state.metadata ?? {}) as PimpMyRideMetadata;
}

function getProgress(
  meta: PimpMyRideMetadata,
  playerId: number,
): PimpMyRidePlayerProgress {
  return (
    meta.progress?.[playerId] ?? {
      stageIndex: 0,
      carParts: [],
      completedCars: [],
    }
  );
}

function getRequiredCategory(
  progress: PimpMyRidePlayerProgress,
): (typeof PIMP_MY_RIDE_CATEGORY_ORDER)[number] {
  const stage = progress.stageIndex % PIMP_MY_RIDE_CATEGORY_ORDER.length;
  return PIMP_MY_RIDE_CATEGORY_ORDER[stage];
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const meta = getMeta(state);
  if (meta.winnerId != null) return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];

  const progress = getProgress(meta, playerId);
  const requiredCategory = getRequiredCategory(progress);
  const hand = Array.isArray(meta.hands?.[playerId])
    ? meta.hands[playerId]
    : [];
  const actions: GameSingleActionDto[] = [{ type: 'pass', payload: {} }];

  for (const cardId of hand) {
    const definition = PIMP_MY_RIDE_CARD_BY_ID[cardId];
    if (!definition) continue;
    if (definition.category === requiredCategory) {
      actions.push({ type: 'play_card', payload: { cardId } });
    }
  }

  if (meta.drawnPlayerId === playerId && meta.drawnCardId) {
    actions.push({
      type: 'discard_card',
      payload: { cardId: meta.drawnCardId },
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
  const payload = (action?.payload ?? {}) as PimpMyRideActionPayload;
  if (type !== 'play_card' && type !== 'discard_card' && type !== 'pass') {
    throw new Error(`Action inconnue : ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis.');
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error("La partie n'est pas commencée.");
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }

  const meta = getMeta(state);
  if (meta.winnerId != null) {
    throw new Error('La partie est déjà terminée.');
  }

  if (type === 'pass') {
    return { type: 'pass', payload: {} };
  }

  const cardId = String(payload.cardId ?? '').trim();
  if (!cardId) {
    throw new Error('Carte manquante.');
  }

  const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
  if (!hand.includes(cardId)) {
    throw new Error('Carte indisponible.');
  }

  const definition = PIMP_MY_RIDE_CARD_BY_ID[cardId];
  if (!definition) {
    throw new Error('Carte invalide.');
  }

  if (type === 'play_card') {
    const progress = getProgress(meta, actorId);
    const requiredCategory = getRequiredCategory(progress);
    if (definition.category !== requiredCategory) {
      throw new Error("La carte ne correspond pas à l'étape en cours.");
    }
    return { type: 'play_card', payload: { cardId } };
  }

  if (type === 'discard_card') {
    if (meta.drawnPlayerId !== actorId || meta.drawnCardId !== cardId) {
      throw new Error('Vous ne pouvez jeter que la carte récemment piochée.');
    }
    return { type: 'discard_card', payload: { cardId } };
  }

  return { type: 'pass', payload: {} };
}
