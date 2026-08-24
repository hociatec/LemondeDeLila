import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type {
  ContesCard,
  ContesCardType,
} from '../model/contes-et-cacahuetes-state.model';

type DrawType = 'bonus' | 'malus' | 'surprise' | 'conte';

export function resolveContesQueuedDraw(input: {
  state: GameStateEntity;
  playerId: number;
  data: { queue?: string[]; cardType?: string; depth?: number };
  maybeProtectFromMalus: (
    state: GameStateEntity,
    playerId: number,
  ) => { protected: boolean; state: GameStateEntity };
  continueQueuedDraw: (
    state: GameStateEntity,
    playerId: number,
    queue: string[],
    depth: number,
  ) => GameStateEntity;
  drawCard: (
    state: GameStateEntity,
    type: DrawType,
  ) => { state: GameStateEntity; card: ContesCard | null };
  announceDrawnCard: (
    state: GameStateEntity,
    playerId: number,
    card: ContesCard,
  ) => GameStateEntity;
  applyBonusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  applyMalusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  applySurpriseEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  attachQueuedDrawContinuation: (
    state: GameStateEntity,
    queue: string[],
    depth: number,
    playerId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const queue = Array.isArray(input.data.queue) ? [...input.data.queue] : [];
  const fallbackType = String(input.data.cardType ?? '')
    .trim()
    .toLowerCase();
  const currentType = (queue.shift() ?? fallbackType) as DrawType;
  const depth = Number.isFinite(input.data.depth) ? Number(input.data.depth) : 0;

  if (!currentType) return input.state;

  if (currentType === 'malus') {
    const protectedOut = input.maybeProtectFromMalus(input.state, input.playerId);
    if (protectedOut.protected) {
      return input.continueQueuedDraw(
        protectedOut.state,
        input.playerId,
        queue,
        depth,
      );
    }
  }

  const draw = input.drawCard(input.state, currentType);
  let next = draw.state;
  const card = draw.card;
  if (!card) {
    return input.continueQueuedDraw(next, input.playerId, queue, depth);
  }

  next = input.announceDrawnCard(next, input.playerId, card);

  if (card.type === 'conte') {
    return input.continueQueuedDraw(next, input.playerId, queue, depth);
  }
  if (card.type === 'bonus') {
    next = input.applyBonusEffectById(next, input.playerId, card.id, depth);
  } else if (card.type === 'malus') {
    next = input.applyMalusEffectById(next, input.playerId, card.id, depth);
  } else if (card.type === 'surprise') {
    next = input.applySurpriseEffectById(next, input.playerId, card.id, depth);
  }

  if (next.pending) {
    return input.attachQueuedDrawContinuation(next, queue, depth, input.playerId);
  }
  return input.continueQueuedDraw(next, input.playerId, queue, depth);
}

export function resolveContesAbondanceDraw(input: {
  state: GameStateEntity;
  playerId: number;
  data: { remaining?: number; drawn?: ContesCard[]; depth?: number };
  drawCard: (
    state: GameStateEntity,
    type: ContesCardType,
  ) => { state: GameStateEntity; card: ContesCard | null };
  announceDrawnCard: (
    state: GameStateEntity,
    playerId: number,
    card: ContesCard,
  ) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Record<string, unknown>,
  ) => GameStateEntity;
  applyBonusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const remaining = Number.isFinite(input.data.remaining)
    ? Number(input.data.remaining)
    : 0;
  const drawn = Array.isArray(input.data.drawn) ? [...input.data.drawn] : [];
  if (remaining <= 0) return input.state;

  const draw = input.drawCard(input.state, 'bonus');
  let next = draw.state;
  if (draw.card) {
    drawn.push(draw.card);
    next = input.announceDrawnCard(next, input.playerId, draw.card);
  }

  if (remaining - 1 > 0) {
    return input.setPending(next, {
      type: 'draw',
      label: 'Corne d’abondance : piocher une carte Bonus (Espace).',
      playerId: input.playerId,
      blocking: true,
      data: {
        context: 'abondance',
        remaining: remaining - 1,
        drawn,
      },
    });
  }

  if (drawn.length === 0) return next;
  if (drawn.length === 1) {
    return input.applyBonusEffectById(next, input.playerId, drawn[0].id, 0);
  }

  return input.setPending(next, {
    type: 'choose_card',
    label:
      'Corne d’abondance : choisissez la carte Bonus à garder, puis Entrée.',
    playerId: input.playerId,
    blocking: true,
    choices: drawn.map((card) => card.title),
    data: {
      context: `abondance_keep_one:${input.playerId}`,
      cards: drawn.map((card) => ({
        cardType: 'bonus',
        cardId: card.id,
        title: card.title,
      })),
    },
  });
}




