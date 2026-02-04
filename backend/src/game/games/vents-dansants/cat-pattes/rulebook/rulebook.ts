import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  CAT_PATTES_CARD_BY_ID,
  CatPattesCardDefinition,
  CatPattesObstacleType,
  CatPattesParadeType,
} from '../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';

type CatPattesActionType = 'play_card' | 'pass';

type CatPattesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
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
  if (!obstacle) {
    return true;
  }
  if (hasBot(bots, 'patte-blindee')) {
    return true;
  }
  return false;
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

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  const meta = getMeta(state);
  const hand = Array.isArray(meta.hands?.[playerId]) ? [...meta.hands[playerId]] : [];
  const actions: GameSingleActionDto[] = [
    { type: 'pass', payload: {} },
  ];
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
  if (type !== 'play_card' && type !== 'pass') {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error('La partie n\'est pas démarrée.');
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }

  if (type === 'pass') {
    return { type: 'pass', payload: {} };
  }

  const cardId = String(payload.cardId ?? '').trim();
  if (!cardId) {
    throw new Error('Carte introuvable.');
  }
  const meta = getMeta(state);
  const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
  if (!hand.includes(cardId)) {
    throw new Error('Carte indisponible.');
  }
  const definition = CAT_PATTES_CARD_BY_ID[cardId];
  if (!definition) {
    throw new Error('Carte invalide.');
  }

  if (definition.type === 'pattes' && !canPlayPattes(meta, actorId, definition)) {
    throw new Error('Impossible de courir maintenant (pas de soleil ou obstacle).');
  }

  if (definition.type === 'obstacle') {
    const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
    if (targetId == null) {
      throw new Error('La cible est requise pour une carte Obstacle.');
    }
    if (targetId === actorId) {
      throw new Error('Impossible de s\'infliger son propre obstacle.');
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

  return { type: 'play_card', payload };
}
