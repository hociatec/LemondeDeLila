import { defineAction, gameInput } from '../../../core/application/public-api';
import { PIRATES_CONTENT } from './content';
import type {
  PirateCard,
  PirateCollection,
  PiratePendingEffect,
  PiratesState,
} from './state';

type DeckName = 'bonus' | 'treasure' | 'obstacle';
type PirateEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'skip'; turns: number }
  | { kind: 'immunity'; turns: number }
  | { kind: 'gain-gold'; amount: number }
  | { kind: 'lose-gold'; amount: number }
  | { kind: 'reroll' }
  | { kind: 'target-move'; delta: number }
  | { kind: 'steal-treasure' };

const TRACK = 'island';
const BONUS_EFFECTS: Record<number, PirateEffect> = {
  1: { kind: 'move', delta: 2 },
  2: { kind: 'immunity', turns: 1 },
  3: { kind: 'reroll' },
  4: { kind: 'move', delta: 2 },
  5: { kind: 'immunity', turns: 1 },
  6: { kind: 'move', delta: 3 },
  7: { kind: 'target-move', delta: -1 },
  8: { kind: 'gain-gold', amount: 1 },
  9: { kind: 'steal-treasure' },
  10: { kind: 'immunity', turns: 2 },
};
const OBSTACLE_EFFECTS: Record<number, PirateEffect> = {
  1: { kind: 'move', delta: -2 },
  2: { kind: 'skip', turns: 1 },
  3: { kind: 'skip', turns: 1 },
  4: { kind: 'move', delta: -1 },
  5: { kind: 'skip', turns: 1 },
  6: { kind: 'skip', turns: 1 },
  7: { kind: 'lose-gold', amount: 1 },
  8: { kind: 'skip', turns: 2 },
  9: { kind: 'move', delta: -1 },
  10: { kind: 'lose-gold', amount: 1 },
};

export const roll = defineAction<PiratesState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé, avance et résout la case atteinte.',
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    const position = ctx.movement.move(TRACK, actor.id, value);
    ctx.history.add(`${actor.username} lance le dé : « ${value} ».`);
    resolveLanding(state, actor.id, position, ctx);
    if (state.winnerId != null || state.pendingEffect != null) return;
    ctx.turn.end();
  },
});

export const PIRATES_ACTIONS = { roll };

export function resolveTargetChoice(
  state: PiratesState,
  targetId: number,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const pending = state.pendingEffect;
  if (!pending) throw new Error('Effet pirate en attente introuvable');
  if (pending.kind === 'target-move') {
    ctx.movement.move(TRACK, targetId, pending.delta);
    ctx.history.add(
      `${ctx.players.get(targetId)?.username ?? 'La cible'} recule d’une case.`,
    );
  } else {
    stealTreasure(state, pending.actorId, targetId, ctx);
  }
  state.pendingEffect = null;
  ctx.turn.end();
}

export function skipPenalizedPlayer(
  state: PiratesState,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(`${current.username} saute son tour.`);
  ctx.turn.end();
}

function resolveLanding(
  state: PiratesState,
  playerId: number,
  position: number,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const tile = PIRATES_CONTENT.tiles[position];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le pirate'} atteint ${tile.title}.`,
  );
  if (
    tile.type === 'bonus' ||
    tile.type === 'treasure' ||
    tile.type === 'obstacle'
  ) {
    drawCard(state, playerId, tile.type, ctx);
  } else if (tile.type === 'gold') {
    state.collections[playerId].goldPieces += 1;
  } else if (tile.type === 'finish') {
    finishOrRetreat(state, playerId, ctx);
  }
}

function drawCard(
  state: PiratesState,
  playerId: number,
  deck: DeckName,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const card = ctx.cards.drawOrRecycle<PirateCard>(deck);
  if (!card) return;
  ctx.cards.discard(deck, card);
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le pirate'} pioche « ${card.title} ».`,
  );
  addToCollection(state.collections[playerId], deck, card);
  if (deck === 'bonus')
    applyEffect(state, playerId, BONUS_EFFECTS[card.id], ctx);
  if (deck === 'obstacle') applyObstacle(state, playerId, card, ctx);
}

function applyObstacle(
  state: PiratesState,
  playerId: number,
  card: PirateCard,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  if (state.obstacleImmunity[playerId] > 0) {
    state.obstacleImmunity[playerId] -= 1;
    ctx.history.add('La protection pirate neutralise cet obstacle.');
    return;
  }
  applyEffect(state, playerId, OBSTACLE_EFFECTS[card.id], ctx);
}

function applyEffect(
  state: PiratesState,
  playerId: number,
  effect: PirateEffect | undefined,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  if (!effect) return;
  if (effect.kind === 'move') ctx.movement.move(TRACK, playerId, effect.delta);
  else if (effect.kind === 'skip') state.skipTurns[playerId] += effect.turns;
  else if (effect.kind === 'immunity') {
    state.obstacleImmunity[playerId] += effect.turns;
  } else if (effect.kind === 'gain-gold') {
    state.collections[playerId].goldPieces += effect.amount;
  } else if (effect.kind === 'lose-gold') {
    state.collections[playerId].goldPieces = Math.max(
      0,
      state.collections[playerId].goldPieces - effect.amount,
    );
  } else if (effect.kind === 'reroll') {
    ctx.turn.extra();
  } else if (effect.kind === 'target-move') {
    requestTarget(state, playerId, effect, ctx);
  } else if (effect.kind === 'steal-treasure') {
    requestTarget(state, playerId, effect, ctx);
  }
}

function requestTarget(
  state: PiratesState,
  playerId: number,
  effect: Extract<PirateEffect, { kind: 'target-move' | 'steal-treasure' }>,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const options = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .map((player) => player.id);
  if (options.length === 0) return;
  const pending: PiratePendingEffect =
    effect.kind === 'target-move'
      ? { kind: 'target-move', actorId: playerId, delta: effect.delta }
      : { kind: 'steal-treasure', actorId: playerId };
  state.pendingEffect = pending;
  ctx.choice.one({
    id: 'pirates.target',
    player: playerId,
    options,
    label: (targetId) =>
      ctx.players.get(targetId)?.username ?? String(targetId),
  });
}

function stealTreasure(
  state: PiratesState,
  actorId: number,
  targetId: number,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const treasures = state.collections[targetId].treasures;
  const card = treasures.pop();
  if (!card) {
    ctx.history.add('Le pirate ciblé ne possède aucun trésor.');
    return;
  }
  state.collections[actorId].treasures.push(card);
}

function addToCollection(
  collection: PirateCollection,
  deck: DeckName,
  card: PirateCard,
): void {
  const total =
    collection.treasures.length +
    collection.obstacles.length +
    collection.bonus.length;
  if (total >= 5) return;
  if (deck === 'treasure') collection.treasures.push(card);
  else if (deck === 'obstacle') collection.obstacles.push(card);
  else collection.bonus.push(card);
}

function finishOrRetreat(
  state: PiratesState,
  playerId: number,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const collection = state.collections[playerId];
  if (collection.treasures.length >= 3 || collection.goldPieces >= 3) {
    state.winnerId = playerId;
    ctx.history.add(
      `${ctx.players.get(playerId)?.username ?? 'Le pirate'} ouvre le coffre légendaire.`,
    );
  } else {
    ctx.movement.move(TRACK, playerId, -2);
    ctx.history.add('Le coffre reste fermé : le pirate recule de deux cases.');
  }
}
