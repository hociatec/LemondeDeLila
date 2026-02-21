import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  CAT_PATTES_CARD_BY_ID,
  CatPattesCardDefinition,
  CatPattesObstacleType,
  CatPattesParadeType,
} from '../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import { CAT_PATTES_GOAL } from '../model/cat-pattes-state.entity';
import { normalizeActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../core/helpers/pawn-pending-rulebook.helper';

type CatPattesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
  pawnId?: string | null;
  pawn?: string | null;
  value?: string | null;
};

function getMeta(state: GameStateEntity): CatPattesMetadata {
  return (state.metadata ?? {}) as CatPattesMetadata;
}

export const CAT_PATTES_OBSTACLE_TO_PARADE: Record<
  CatPattesObstacleType,
  CatPattesParadeType
> = {
  gamelle: 'croquettes',
  pluie: 'rayon',
  chien: 'saut',
  coussin: 'coussin',
  sol: 'dodo',
};

function hasBot(
  bots: CatPattesMetadata['bots'][number],
  type: string,
): boolean {
  return Array.isArray(bots) && bots.includes(type as any);
}

function samePlayerId(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function toPlayerId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

export function canPlayPattes(
  meta: CatPattesMetadata,
  playerId: number,
  card: CatPattesCardDefinition,
): boolean {
  const hasSun = Boolean(meta.hasSun?.[playerId]);
  const bots = meta.bots?.[playerId] ?? [];
  const obstacle = meta.obstacles?.[playerId] ?? null;
  const passageStar = hasBot(bots, 'passage-star');
  if (!hasSun && !passageStar) {
    return false;
  }
  if (obstacle && !hasBot(bots, 'patte-blindee')) {
    return false;
  }
  const currentPos = Number(meta.positions?.[playerId] ?? 0);
  const delta = Number(card.value ?? 0);
  if (!Number.isFinite(delta) || delta <= 0) return false;
  return currentPos + delta <= CAT_PATTES_GOAL;
}

export function playerCanReceiveObstacle(
  meta: CatPattesMetadata,
  playerId: number,
  obstacle: CatPattesObstacleType,
): boolean {
  const bots = meta.bots?.[playerId] ?? [];
  if (hasBot(bots, 'patte-blindee')) {
    return false;
  }
  if (obstacle === 'chien' && hasBot(bots, 'chat-ninja')) {
    return false;
  }
  if (obstacle === 'gamelle' && hasBot(bots, 'reserve')) {
    return false;
  }
  return !meta.obstacles?.[playerId];
}

function normalizePawnKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    const pawnActions = getPendingPawnActionsForPlayer(
      pending,
      playerId,
      'choose_pawn',
    );
    if (pawnActions.length > 0) {
      return pawnActions;
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, playerId)) return [];

  const meta = getMeta(state);
  if (!samePlayerId(meta.drawnPlayerId, playerId)) {
    return [{ type: 'draw', payload: {} }];
  }

  const hand = Array.isArray(meta.hands?.[playerId])
    ? [...meta.hands[playerId]]
    : [];
  const actions: GameSingleActionDto[] = [];
  const opponents = (Array.isArray(state.players) ? state.players : [])
    .filter((p) => p?.id != null && p.id !== playerId)
    .map((p) => p.id);

  for (const cardId of hand) {
    const definition = CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) continue;
    if (
      definition.type === 'pattes' &&
      !canPlayPattes(meta, playerId, definition)
    ) {
      continue;
    }
    if (definition.type === 'obstacle') {
      for (const target of opponents) {
        if (!playerCanReceiveObstacle(meta, target, definition.obstacle!)) {
          continue;
        }
        actions.push({
          type: 'play_card',
          payload: { cardId, targetPlayerId: target },
        });
      }
    } else {
      actions.push({
        type: 'play_card',
        payload: { cardId },
      });
    }
    actions.push({
      type: 'discard_card',
      payload: { cardId },
    });
  }

  if (actions.length === 0) {
    return [{ type: 'pass', payload: {} }];
  }

  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  const payload = (action?.payload ?? {}) as CatPattesActionPayload;
  if (
    type !== 'play_card' &&
    type !== 'discard_card' &&
    type !== 'draw' &&
    type !== 'choose_pawn' &&
    type !== 'pass'
  ) {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error("La partie n'est pas démarrée.");
  }

  const pending = state.pending as any;
  if (pending) {
    const pawnValidation = validatePendingPawnActionForActor({
      pending,
      actorId,
      actionType: type,
      payload,
      pendingType: 'choose_pawn',
      idResolver: (value) => normalizePawnKey(value),
    });
    if (pawnValidation.ok) {
      return pawnValidation.action;
    }
    if (pawnValidation.reason === 'wrong_action_type') {
      throw new Error('Action indisponible (choix de pion requis).');
    }
    if (pawnValidation.reason === 'invalid_pawn') {
      throw new Error('Pion invalide.');
    }
    throw new Error('Action indisponible (choix en attente).');
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, actorId)) {
    throw new Error("Ce n'est pas votre tour.");
  }

  const meta = getMeta(state);
  if (!samePlayerId(meta.drawnPlayerId, actorId)) {
    if (type !== 'draw') {
      throw new Error("Vous devez d'abord piocher.");
    }
    return { type: 'draw', payload: {} };
  }

  if (type === 'draw') {
    throw new Error('Carte déjà piochée ce tour.');
  }

  if (type === 'pass') {
    return { type: 'discard_card', payload: {} };
  }

  const cardId = String(payload.cardId ?? '').trim();
  if (!cardId) {
    throw new Error('Carte introuvable.');
  }
  const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
  if (!hand.includes(cardId)) {
    throw new Error('Carte indisponible.');
  }
  const definition = CAT_PATTES_CARD_BY_ID[cardId];
  if (!definition) {
    throw new Error('Carte invalide.');
  }

  if (type === 'discard_card') {
    return { type: 'discard_card', payload: { cardId } };
  }

  if (
    definition.type === 'pattes' &&
    !canPlayPattes(meta, actorId, definition)
  ) {
    throw new Error('Impossible de courir maintenant.');
  }

  if (definition.type === 'obstacle') {
    const targetId =
      typeof payload.targetPlayerId === 'number'
        ? payload.targetPlayerId
        : null;
    if (targetId == null) {
      throw new Error('La cible est requise pour une carte Obstacle.');
    }
    if (targetId === actorId) {
      throw new Error("Impossible de s'infliger son propre obstacle.");
    }
    const targetHand = Array.isArray(state.players) ? state.players : [];
    const exists = targetHand.some((p) => samePlayerId(p?.id, targetId));
    if (!exists) {
      throw new Error('Joueur cible invalide.');
    }
    if (!playerCanReceiveObstacle(meta, targetId, definition.obstacle!)) {
      throw new Error('La cible ne peut pas recevoir cet obstacle.');
    }
  }

  return { type: 'play_card', payload: { ...payload, cardId } };
}
