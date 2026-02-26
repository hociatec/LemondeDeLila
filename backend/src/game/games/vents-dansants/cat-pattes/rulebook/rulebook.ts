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
import { stringOrEmpty } from '@common/utils/string-value.utils';

type CatPattesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
  pawnId?: string | null;
  pawn?: string | null;
  value?: string | null;
  goalPattes?: number | null;
};

function getMeta(state: GameStateEntity): CatPattesMetadata {
  return (state.metadata ?? {}) as CatPattesMetadata;
}

function getGoalPattes(meta: CatPattesMetadata): number {
  const parsed = Number(meta.goalPattes ?? CAT_PATTES_GOAL);
  if (!Number.isFinite(parsed)) return CAT_PATTES_GOAL;
  const rounded = Math.round(parsed);
  if (rounded < 600 || rounded > 1500) return CAT_PATTES_GOAL;
  return rounded;
}

export const CAT_PATTES_OBSTACLE_TO_PARADE: Record<
  CatPattesObstacleType,
  CatPattesParadeType
> = {
  gamelle: 'croquettes',
  pluie: 'rayon',
  chien: 'dodo',
  coussin: 'coussin',
  sol: 'saut',
};

function hasBot(
  bots: CatPattesMetadata['bots'][number],
  type: string,
): boolean {
  return Array.isArray(bots) && bots.includes(type as any);
}

function obstacleIsIgnoredByBots(
  obstacle: CatPattesObstacleType,
  bots: CatPattesMetadata['bots'][number],
): boolean {
  if (obstacle === 'gamelle' && hasBot(bots, 'reserve')) {
    return true;
  }
  if (obstacle === 'chien' && hasBot(bots, 'chat-ninja')) {
    return true;
  }
  if (obstacle === 'coussin' && hasBot(bots, 'patte-blindee')) {
    return true;
  }
  if (
    (obstacle === 'pluie' || obstacle === 'sol') &&
    hasBot(bots, 'passage-star')
  ) {
    return true;
  }
  return false;
}

function samePlayerId(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
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
  if (obstacle && !obstacleIsIgnoredByBots(obstacle, bots)) {
    return false;
  }
  const currentPos = Number(meta.positions?.[playerId] ?? 0);
  const delta = Number(card.value ?? 0);
  if (!Number.isFinite(delta) || delta <= 0) return false;
  return currentPos + delta <= getGoalPattes(meta);
}

export function playerCanReceiveObstacle(
  meta: CatPattesMetadata,
  playerId: number,
  obstacle: CatPattesObstacleType,
): boolean {
  const bots = meta.bots?.[playerId] ?? [];
  if (obstacleIsIgnoredByBots(obstacle, bots)) {
    return false;
  }
  return !meta.obstacles?.[playerId];
}

function normalizePawnKey(value: unknown): string {
  return stringOrEmpty(value)
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

  const meta = getMeta(state);
  if ((meta.setupStep ?? '') === 'setup_config') {
    if (meta.ownerPlayerId != null && samePlayerId(meta.ownerPlayerId, playerId)) {
      return [{ type: 'cat_pattes_set_config', payload: {} }];
    }
    return [];
  }

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
    type !== 'cat_pattes_set_config' &&
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

  const meta = getMeta(state);
  if ((meta.setupStep ?? '') === 'setup_config') {
    if (type !== 'cat_pattes_set_config') {
      throw new Error('Configuration requise avant de commencer.');
    }
    if (!samePlayerId(meta.ownerPlayerId, actorId)) {
      throw new Error("Seul le propriétaire de la table peut configurer.");
    }
    const goal = Number(payload.goalPattes ?? payload.value ?? null);
    if (!Number.isFinite(goal)) {
      throw new Error('Objectif de pattes invalide.');
    }
    const roundedGoal = Math.round(goal);
    if (roundedGoal < 600 || roundedGoal > 1500) {
      throw new Error('Objectif de pattes hors limites (600-1500).');
    }
    return {
      type: 'cat_pattes_set_config',
      payload: { goalPattes: roundedGoal },
    };
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
  if (!cardId && type === 'play_card') {
    // Robust fallback: if the client sends a play action without cardId, discard instead.
    return { type: 'discard_card', payload: {} };
  }
  if (!cardId && type !== 'discard_card') {
    throw new Error('Carte introuvable.');
  }
  const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];

  if (type === 'discard_card') {
    if (!cardId) {
      return { type: 'discard_card', payload: {} };
    }
    if (!hand.includes(cardId)) {
      throw new Error('Carte indisponible.');
    }
    return { type: 'discard_card', payload: { cardId } };
  }
  if (!hand.includes(cardId)) {
    throw new Error('Carte indisponible.');
  }
  const definition = CAT_PATTES_CARD_BY_ID[cardId];
  if (!definition) {
    throw new Error('Carte invalide.');
  }

  if (
    definition.type === 'pattes' &&
    !canPlayPattes(meta, actorId, definition)
  ) {
    const bots = meta.bots?.[actorId] ?? [];
    const passageStar = hasBot(bots, 'passage-star');
    const hasSun = Boolean(meta.hasSun?.[actorId]);
    const obstacle = meta.obstacles?.[actorId] ?? null;
    if (!hasSun && !passageStar) {
      throw new Error(
        "Impossible de jouer Pattes: aucun Rayon de soleil actif.",
      );
    }
    if (obstacle && !obstacleIsIgnoredByBots(obstacle, bots)) {
      throw new Error(
        'Impossible de jouer Pattes: un obstacle vous bloque.',
      );
    }
    const currentPos = Number(meta.positions?.[actorId] ?? 0);
    const delta = Number(definition.value ?? 0);
    if (Number.isFinite(delta) && currentPos + delta > getGoalPattes(meta)) {
      throw new Error(
        `Impossible de jouer Pattes: depassement de ${getGoalPattes(meta)} pattes.`,
      );
    }
    throw new Error('Impossible de jouer Pattes.');
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
      throw new Error(
        "La cible ne peut pas recevoir cet obstacle (deja protegee ou deja un obstacle).",
      );
    }
  }

  return { type: 'play_card', payload: { ...payload, cardId } };
}
