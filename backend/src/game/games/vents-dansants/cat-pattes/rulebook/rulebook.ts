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

function hasBot(bots: CatPattesMetadata['bots'][number], type: string): boolean {
  return Array.isArray(bots) && bots.includes(type as any);
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
  return !(meta.obstacles?.[playerId]);
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
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (
      pending.type === 'choose_pawn' &&
      samePlayerId(pending.playerId, playerId)
    ) {
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((p) => String(p?.id ?? '').trim())
        .filter((id) => id.length > 0)
        .map((id) => ({ type: 'choose_pawn', payload: { pawnId: id } }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, playerId)) return [];

  const meta = getMeta(state);
  if (meta.drawnPlayerId !== playerId) {
    return [{ type: 'draw', payload: {} }];
  }

  const hand = Array.isArray(meta.hands?.[playerId]) ? [...meta.hands[playerId]] : [];
  const actions: GameSingleActionDto[] = [];
  const opponents = (Array.isArray(state.players) ? state.players : [])
    .filter((p) => p?.id != null && p.id !== playerId)
    .map((p) => p!.id);

  for (const cardId of hand) {
    const definition = CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) continue;
    if (definition.type === 'pattes' && !canPlayPattes(meta, playerId, definition)) {
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

  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = String(action?.type ?? '').trim();
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
    if (
      pending.type === 'choose_pawn' &&
      samePlayerId(pending.playerId, actorId)
    ) {
      if (type !== 'choose_pawn') {
        throw new Error('Action indisponible (choix de pion requis).');
      }
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
      const key = normalizePawnKey(rawPawn);
      const chosen = pawns.find((p) => normalizePawnKey(p?.id) === key);
      if (!chosen) {
        throw new Error('Pion invalide.');
      }
      return { type: 'choose_pawn', payload: { pawnId: chosen.id } };
    }
    throw new Error('Action indisponible (choix en attente).');
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, actorId)) {
    throw new Error("Ce n'est pas votre tour.");
  }

  const meta = getMeta(state);
  if (meta.drawnPlayerId !== actorId) {
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

  if (definition.type === 'pattes' && !canPlayPattes(meta, actorId, definition)) {
    throw new Error('Impossible de courir maintenant.');
  }

  if (definition.type === 'obstacle') {
    const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
    if (targetId == null) {
      throw new Error('La cible est requise pour une carte Obstacle.');
    }
    if (targetId === actorId) {
      throw new Error("Impossible de s'infliger son propre obstacle.");
    }
    const targetHand = Array.isArray(state.players) ? state.players : [];
    const exists = targetHand.some((p) => p?.id === targetId);
    if (!exists) {
      throw new Error('Joueur cible invalide.');
    }
    if (!playerCanReceiveObstacle(meta, targetId, definition.obstacle!)) {
      throw new Error('La cible ne peut pas recevoir cet obstacle.');
    }
  }

  return { type: 'play_card', payload: { ...payload, cardId } };
}
