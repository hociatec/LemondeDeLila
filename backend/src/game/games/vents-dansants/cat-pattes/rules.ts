import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  CAT_PATTES_CARD_BY_ID,
  CAT_PATTES_DECK,
  CAT_PATTES_GOAL,
  type CatPattesBotType,
  type CatPattesCardDefinition,
  type CatPattesObstacleType,
  type CatPattesParadeType,
} from './content';
import type { CatPattesState } from './state';

const DECK = 'cat-pattes';
const HANDS = 'players';
type RuleContext = GameRuleContext<CatPattesState>;
type CardInput = { cardId: string; targetPlayerId?: number };

const OBSTACLE_TO_PARADE: Record<CatPattesObstacleType, CatPattesParadeType> = {
  gamelle: 'croquettes',
  pluie: 'rayon',
  chien: 'dodo',
  coussin: 'coussin',
  sol: 'saut',
};

const PARADE_DISABLED_BY_POWER: Record<
  CatPattesBotType,
  CatPattesParadeType[]
> = {
  reserve: ['croquettes'],
  'chat-ninja': ['dodo'],
  'patte-blindee': ['coussin'],
  'passage-star': ['rayon', 'saut'],
};

export const draw = defineAction<CatPattesState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Pioche une carte au début du tour, une seule fois.',
  available: ({ state, actor }) =>
    state.configComplete && state.drawnPlayerId !== actor.id,
  execute: ({ state, actor, ctx }) => {
    if (state.drawnPlayerId === actor.id) throw new Error('Pioche déjà faite');
    const cardId = ctx.cards.drawOrRecycle<string>(DECK);
    state.drawnPlayerId = actor.id;
    if (cardId) {
      ctx.cards.give(HANDS, actor.id, cardId);
      ctx.history.add(`${actor.username} pioche une carte.`);
      return;
    }
    if (ctx.cards.hand<string>(HANDS, actor.id).length === 0) {
      state.drawnPlayerId = null;
      ctx.history.add(`${actor.username} passe faute de carte.`);
      ctx.turn.end();
    }
  },
});

export const playCard = defineAction<CatPattesState, CardInput>({
  input: gameInput.object({
    cardId: gameInput.cardId(),
    targetPlayerId: gameInput.optional(gameInput.playerId()),
  }),
  documentation:
    'Joue une carte Pattes, Obstacle, Parade ou Pouvoir autorisée.',
  available: ({ state, actor, ctx }) =>
    state.configComplete &&
    state.drawnPlayerId === actor.id &&
    playableInputs(state, actor.id, ctx).length > 0,
  availableInputs: ({ state, actor, ctx }) =>
    playableInputs(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    if (state.drawnPlayerId !== actor.id) {
      throw new Error('Vous devez piocher avant de jouer');
    }
    if (!includesInput(playableInputs(state, actor.id, ctx), input)) {
      throw new Error('Carte Cat Pattes indisponible');
    }
    const card = CAT_PATTES_CARD_BY_ID[input.cardId];
    ctx.cards.play(HANDS, DECK, actor.id, input.cardId);
    ctx.history.add(`${actor.username} joue ${card.name}.`);
    applyCard(state, actor.id, input.targetPlayerId ?? null, card, ctx);
    state.drawnPlayerId = null;
    if (state.winnerId != null) return;
    if (card.type !== 'bot') ctx.turn.end();
  },
});

export const discard = defineAction<CatPattesState, { cardId?: string }>({
  input: gameInput.object({ cardId: gameInput.optional(gameInput.cardId()) }),
  documentation: 'Défausse une carte jouable ou passe avec une main vide.',
  available: ({ state, actor, ctx }) =>
    state.configComplete &&
    state.drawnPlayerId === actor.id &&
    !mustCounter(state, actor.id, ctx),
  availableInputs: ({ state, actor, ctx }) => {
    if (state.drawnPlayerId !== actor.id || mustCounter(state, actor.id, ctx)) {
      return [];
    }
    const hand = ctx.cards.hand<string>(HANDS, actor.id);
    return hand.length === 0 ? [{}] : hand.map((cardId) => ({ cardId }));
  },
  execute: ({ state, actor, input, ctx }) => {
    if (state.drawnPlayerId !== actor.id || mustCounter(state, actor.id, ctx)) {
      throw new Error('Défausse Cat Pattes interdite');
    }
    const hand = ctx.cards.hand<string>(HANDS, actor.id);
    const cardId = input.cardId ?? hand[0];
    if (cardId) ctx.cards.play(HANDS, DECK, actor.id, cardId);
    state.drawnPlayerId = null;
    ctx.turn.end();
  },
});

export const CAT_PATTES_ACTIONS = {
  draw,
  play_card: playCard,
  discard_card: discard,
};

export function resolveRounds(
  state: CatPattesState,
  rounds: number,
  ctx: RuleContext,
): void {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
    throw new Error('Nombre de manches invalide');
  }
  state.roundsToPlay = rounds;
  state.configComplete = true;
  ctx.transitionTo('playing');
  ctx.turn.to(ctx.players.all()[0].id);
}

export function requestRounds(state: CatPattesState, ctx: RuleContext): void {
  ctx.choice.one({
    id: 'cat-pattes.rounds',
    player: state.ownerPlayerId,
    options: Array.from({ length: 20 }, (_entry, index) => index + 1),
    label: (rounds) => `${rounds} manche(s)`,
  });
}

export function playableInputs(
  state: CatPattesState,
  actorId: number,
  ctx: RuleContext,
): CardInput[] {
  if (state.drawnPlayerId !== actorId) return [];
  const blocked = isBlocked(state, actorId);
  return ctx.cards.hand<string>(HANDS, actorId).flatMap((cardId) => {
    const card = CAT_PATTES_CARD_BY_ID[cardId];
    if (!card || (blocked && card.type !== 'parade' && card.type !== 'bot')) {
      return [];
    }
    if (card.type === 'pattes') {
      return canPlayPattes(state, actorId, card) ? [{ cardId }] : [];
    }
    if (card.type === 'obstacle') {
      if (!card.obstacle) return [];
      return ctx.players
        .all()
        .filter(
          (player) =>
            player.id !== actorId &&
            canReceiveObstacle(state, player.id, card.obstacle!),
        )
        .map((player) => ({ cardId, targetPlayerId: player.id }));
    }
    if (card.type === 'parade') {
      return canPlayParade(state, actorId, card) ? [{ cardId }] : [];
    }
    return canPlayPower(state, actorId, card) ? [{ cardId }] : [];
  });
}

function applyCard(
  state: CatPattesState,
  actorId: number,
  targetId: number | null,
  card: CatPattesCardDefinition,
  ctx: RuleContext,
): void {
  if (card.type === 'pattes') {
    state.positions[actorId] += card.value ?? 0;
    if (card.value === 150) state.turboPlayed[actorId] += 1;
    if (state.positions[actorId] === CAT_PATTES_GOAL)
      finishRound(state, actorId, ctx);
    return;
  }
  if (card.type === 'obstacle' && targetId != null && card.obstacle) {
    state.obstacles[targetId] = card.obstacle;
    return;
  }
  if (card.type === 'parade' && card.parade) {
    applyParade(state, actorId, card.parade);
    return;
  }
  if (card.type === 'bot' && card.bot) applyPower(state, actorId, card.bot);
}

function finishRound(
  state: CatPattesState,
  roundWinnerId: number,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    state.points[player.id] += state.positions[player.id];
  }
  state.completedRounds += 1;
  ctx.history.add(
    `${ctx.players.get(roundWinnerId)?.username} gagne la manche.`,
  );
  if (state.completedRounds >= state.roundsToPlay) {
    state.winnerId = [...ctx.players.all()].sort(
      (left, right) =>
        state.points[right.id] - state.points[left.id] || left.id - right.id,
    )[0].id;
    return;
  }
  resetRound(state, roundWinnerId, ctx);
}

function resetRound(
  state: CatPattesState,
  starterId: number,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    const hand = [...ctx.cards.hand<string>(HANDS, player.id)];
    for (const cardId of hand) ctx.cards.take(HANDS, player.id, cardId);
    ctx.cards.putOnTop(DECK, hand);
  }
  const discarded = ctx.cards.discardPile<string>(DECK);
  for (const cardId of discarded) ctx.cards.takeDiscard(DECK, cardId);
  ctx.cards.putOnTop(DECK, discarded);
  ctx.cards.shuffle(DECK);
  for (const player of ctx.players.all()) {
    state.positions[player.id] = 0;
    state.obstacles[player.id] = null;
    state.powers[player.id] = [];
    state.turboPlayed[player.id] = 0;
    state.hasSun[player.id] = false;
    state.sunReady[player.id] = true;
    state.obstacleLock[player.id] = false;
  }
  ctx.cards.deal(
    DECK,
    HANDS,
    ctx.players.all().map((player) => player.id),
    6,
  );
  state.drawnPlayerId = null;
  ctx.turn.to(starterId);
}

function canPlayPattes(
  state: CatPattesState,
  playerId: number,
  card: CatPattesCardDefinition,
): boolean {
  const passageStar = hasPower(state, playerId, 'passage-star');
  const value = card.value ?? 0;
  return (
    (state.hasSun[playerId] || passageStar) &&
    !isBlocked(state, playerId) &&
    value > 0 &&
    state.positions[playerId] + value <= CAT_PATTES_GOAL
  );
}

function canReceiveObstacle(
  state: CatPattesState,
  playerId: number,
  obstacle: CatPattesObstacleType,
): boolean {
  if (powerIgnoresObstacle(state.powers[playerId], obstacle)) return false;
  if (
    state.obstacleLock[playerId] &&
    !hasPower(state, playerId, 'passage-star')
  ) {
    return false;
  }
  return state.obstacles[playerId] == null;
}

function canPlayParade(
  state: CatPattesState,
  playerId: number,
  card: CatPattesCardDefinition,
): boolean {
  if (!card.parade) return false;
  if (
    state.powers[playerId].some((power) =>
      PARADE_DISABLED_BY_POWER[power].includes(card.parade!),
    )
  ) {
    return false;
  }
  const obstacle = state.obstacles[playerId];
  return obstacle
    ? OBSTACLE_TO_PARADE[obstacle] === card.parade
    : card.parade === 'rayon' && state.sunReady[playerId];
}

function canPlayPower(
  state: CatPattesState,
  playerId: number,
  card: CatPattesCardDefinition,
): boolean {
  if (!card.bot) return false;
  const obstacle = state.obstacles[playerId];
  return obstacle == null || powerIgnoresObstacle([card.bot], obstacle);
}

function applyParade(
  state: CatPattesState,
  playerId: number,
  parade: CatPattesParadeType,
): void {
  const obstacle = state.obstacles[playerId];
  const removes = obstacle != null && OBSTACLE_TO_PARADE[obstacle] === parade;
  if (removes) state.obstacles[playerId] = null;
  if (parade === 'rayon') {
    state.hasSun[playerId] = true;
    state.sunReady[playerId] = false;
    state.obstacleLock[playerId] = false;
  } else if (removes) {
    state.sunReady[playerId] = true;
    state.obstacleLock[playerId] = true;
  }
}

function applyPower(
  state: CatPattesState,
  playerId: number,
  power: CatPattesBotType,
): void {
  if (!state.powers[playerId].includes(power))
    state.powers[playerId].push(power);
  const obstacle = state.obstacles[playerId];
  if (obstacle && powerIgnoresObstacle([power], obstacle)) {
    state.obstacles[playerId] = null;
    state.sunReady[playerId] = true;
    state.obstacleLock[playerId] = power !== 'passage-star';
  }
}

function mustCounter(
  state: CatPattesState,
  playerId: number,
  ctx: RuleContext,
): boolean {
  return (
    isBlocked(state, playerId) &&
    playableInputs(state, playerId, ctx).length > 0
  );
}

function isBlocked(state: CatPattesState, playerId: number): boolean {
  const obstacle = state.obstacles[playerId];
  return (
    obstacle != null &&
    !powerIgnoresObstacle(state.powers[playerId] ?? [], obstacle)
  );
}

function hasPower(
  state: CatPattesState,
  playerId: number,
  power: CatPattesBotType,
): boolean {
  return state.powers[playerId]?.includes(power) ?? false;
}

function powerIgnoresObstacle(
  powers: readonly CatPattesBotType[],
  obstacle: CatPattesObstacleType,
): boolean {
  return powers.some(
    (power) =>
      (power === 'reserve' && obstacle === 'gamelle') ||
      (power === 'chat-ninja' && obstacle === 'chien') ||
      (power === 'patte-blindee' && obstacle === 'coussin') ||
      (power === 'passage-star' &&
        (obstacle === 'pluie' || obstacle === 'sol')),
  );
}

function includesInput(inputs: CardInput[], input: CardInput): boolean {
  return inputs.some(
    (candidate) =>
      candidate.cardId === input.cardId &&
      candidate.targetPlayerId === input.targetPlayerId,
  );
}

export function initialPlayerRecord<T>(
  ctx: RuleContext,
  value: (playerId: number) => T,
): Record<number, T> {
  return Object.fromEntries(
    ctx.players.all().map((player) => [player.id, value(player.id)]),
  );
}

export const CAT_PATTES_CARD_COUNT = CAT_PATTES_DECK.length;
