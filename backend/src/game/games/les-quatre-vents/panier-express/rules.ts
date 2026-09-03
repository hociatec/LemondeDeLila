import {
  defineAction,
  drawAndResolve,
  gameInput,
  positionOf,
  rejectRule,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import {
  PANIER_EVENTS,
  PANIER_EXCHANGES,
  PANIER_STANDS,
  PANIER_TILES,
} from './content';
import type { PanierPending, PanierState } from './types';

type RuleContext = GameContext<PanierState>;
export const PANIER_PHASES = setupPlayingPhases<PanierState>();
const TRACK = 'market';
const INVENTORY = 'market-items';
const SHOPPING_LISTS = 'shopping-lists';
const BASKETS = 'shopping-baskets';
const MAX_DEPTH = 24;
const RESOLVING_PLAYER_FLAG = 'panier.resolving-player';
const PENDING_CARD_DRAW_FLAG = 'panier.pending-card-draw';
export const PANIER_REVERSED = 'panier.reversed-until-owner-turn';
export const PANIER_REVEAL = 'panier.reveal';

export const roll = defineAction<PanierState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout la case du marché.',
  available: ({ ctx }) =>
    PANIER_PHASES.is(ctx, 'playing') &&
    ctx.choice.current() == null &&
    ctx.match.lifecycle() !== 'finished',
  execute: ({ state, actor, ctx }) => {
    ctx.turn.flags.set(RESOLVING_PLAYER_FLAG, actor.id);
    const rollValue = ctx.dice.roll('main').total;
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      total: rollValue,
    });
    moveAndResolve(state, actor.id, rollValue * ctx.turn.direction(), 0, ctx);
    finishResolution(ctx);
  },
});

export const drawCard = defineAction<PanierState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Pioche la carte demandée par la case du marché.',
  available: ({ actor, ctx }) => {
    const pending = ctx.turn.flags.get<PendingCardDraw>(PENDING_CARD_DRAW_FLAG);
    return (
      PANIER_PHASES.is(ctx, 'playing') &&
      pending?.playerId === actor.id &&
      ctx.choice.current() == null &&
      !ctx.effects.isResolving() &&
      ctx.match.lifecycle() !== 'finished'
    );
  },
  execute: ({ actor, ctx }) => {
    const pending = ctx.turn.flags.get<PendingCardDraw>(PENDING_CARD_DRAW_FLAG);
    if (!pending || pending.playerId !== actor.id)
      rejectRule('Aucune carte à piocher');
    ctx.turn.flags.consume(PENDING_CARD_DRAW_FLAG);
    if (pending.deckId === 'events') resolvePanierEvent(actor.id, ctx);
    else drawExchange(actor.id, ctx);
    finishResolution(ctx);
  },
});

export const PANIER_ACTIONS = { roll, draw_card: drawCard };

type PendingCardDraw = {
  playerId: number;
  deckId: 'events' | 'exchanges';
};

const pawnSelection = sequentialPawnSelection<PanierState>({
  setId: 'panier',
  choiceId: 'panier.pawn',
  assigned: ({ playerId, ctx }) => {
    ctx.events.emit(
      'panier.shopping-list.announced',
      {
        playerId,
        items: ctx.inventory.items(SHOPPING_LISTS, playerId),
      },
      { kind: 'private', playerIds: [playerId] },
    );
  },
  complete: ({ ctx }) => {
    PANIER_PHASES.transition(ctx, 'playing');
    const starterId = ctx.round.starter();
    if (starterId != null) ctx.turn.to(starterId);
  },
});

export const requestPawns = pawnSelection.requestAll;
export const resolvePawn = pawnSelection.resolve;

export function resolveDirection(
  state: PanierState,
  actorId: number,
  value: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<PanierPending>();
  if (
    !pending ||
    pending.panierKind !== 'direction' ||
    pending.actorId !== actorId
  )
    rejectRule('Choix de direction absent');
  moveAndResolve(
    state,
    actorId,
    value === 'forward' ? pending.distance : -pending.distance,
    0,
    ctx,
  );
  finishResolution(ctx);
}

export function resolveQuiz(
  state: PanierState,
  actorId: number,
  answerIndex: number,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<PanierPending>();
  if (!pending || pending.panierKind !== 'quiz' || pending.actorId !== actorId)
    rejectRule('Quiz Panier absent');
  const { correct } = ctx.quiz.answer(pending.sessionId, actorId, answerIndex);
  ctx.quiz.close(pending.sessionId);
  ctx.events.message('game.quiz.answered', {
    playerId: actorId,
    correct,
    reward: correct ? 2 : 0,
  });
  if (correct) moveAndResolve(state, actorId, 2, 0, ctx);
  finishResolution(ctx);
}

export function resolveTake(
  actorId: number,
  card: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<PanierPending>();
  if (!pending || pending.panierKind !== 'take' || pending.actorId !== actorId)
    rejectRule('Choix de carte adverse absent');
  if (!ctx.inventory.items(INVENTORY, pending.targetId).includes(card)) {
    rejectRule('Carte adverse absente');
  }
  const ownCards = ctx.inventory.items(INVENTORY, actorId);
  if (ownCards.length === 0) {
    ctx.inventory.transfer(INVENTORY, pending.targetId, actorId, card);
    finishResolution(ctx);
    return;
  }
  const nextPending: PanierPending = {
    panierKind: 'give',
    actorId,
    targetId: pending.targetId,
    take: card,
  };
  ctx.choice.one({
    id: 'panier.give',
    player: actorId,
    options: ownCards,
    data: nextPending,
  });
}

export function resolveGive(
  actorId: number,
  card: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<PanierPending>();
  if (!pending || pending.panierKind !== 'give' || pending.actorId !== actorId)
    rejectRule('Choix de carte à donner absent');
  if (!ctx.inventory.items(INVENTORY, actorId).includes(card)) {
    rejectRule('Carte à donner absente');
  }
  ctx.inventory.exchange(
    INVENTORY,
    pending.targetId,
    pending.take,
    actorId,
    card,
  );
  finishResolution(ctx);
}

export function restoreMovement(playerId: number, ctx: RuleContext): void {
  ctx.status.remove(playerId, PANIER_REVERSED);
  ctx.turn.reverse();
}

export function moveAndResolve(
  state: PanierState,
  playerId: number,
  distance: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (
    depth > MAX_DEPTH ||
    ctx.choice.current() ||
    ctx.match.lifecycle() === 'finished'
  )
    return;
  const before = positionOf(ctx, TRACK, playerId);
  const raw = before + distance;
  ctx.movement.moveAndResolve({
    trackId: TRACK,
    playerId,
    distance,
    tiles: PANIER_TILES,
    depth,
    maxDepth: MAX_DEPTH,
    onLand: () => {
      if (distance > 0 && raw >= PANIER_TILES.length)
        ctx.score.add(playerId, 1);
      resolveTile(state, playerId, depth + 1, ctx);
    },
  });
}

function resolveTile(
  state: PanierState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const tile = PANIER_TILES[positionOf(ctx, TRACK, playerId)];
  if (tile.type === 'start') checkVictory(playerId, ctx);
  else if (tile.type === 'stand') drawCourse(playerId, tile.standId, ctx);
  else if (tile.type === 'bonus_course') drawCourse(playerId, 'bonus', ctx);
  else if (tile.type === 'event') requestCardDraw(playerId, 'events', ctx);
  else if (tile.type === 'exchange')
    requestCardDraw(playerId, 'exchanges', ctx);
  else if (tile.type === 'quiz') requestQuiz(playerId, ctx);
  else if (tile.type === 'move_choice')
    requestDirection(playerId, tile.delta ?? 2, ctx);
  else if (tile.type === 'move') {
    const delta = tile.delta ?? -(1 + ctx.random.int(10));
    moveAndResolve(state, playerId, delta, depth, ctx);
  } else if (tile.type === 'skip') ctx.turn.skip(playerId, tile.turns ?? 1);
  else if (tile.type === 'move_to_stand')
    moveToNearestStand(state, playerId, depth, ctx);
}

export function drawCourse(
  playerId: number,
  standId: string | undefined,
  ctx: RuleContext,
): void {
  const cards = PANIER_STANDS[standId ?? 'bonus'] ?? PANIER_STANDS.bonus;
  const card = ctx.random.pick(cards);
  if (!card) return;
  if (
    ctx.inventory.has(SHOPPING_LISTS, playerId, card) &&
    !ctx.inventory.has(BASKETS, playerId, card)
  ) {
    ctx.inventory.add(BASKETS, playerId, card);
    ctx.events.message('panier.item.added-to-basket', {
      playerId,
      itemId: card,
    });
  } else {
    ctx.inventory.add(INVENTORY, playerId, card);
    ctx.events.message('panier.item.added-to-inventory', {
      playerId,
      itemId: card,
    });
  }
}

function resolvePanierEvent(playerId: number, ctx: RuleContext): void {
  drawAndResolve<PanierState, (typeof PANIER_EVENTS)[number]>(ctx, {
    deckId: 'events',
    playerId,
    automatic: false,
    recycle: true,
    discard: true,
    resolve: (event) => ctx.effects.schedule(...event.effects),
  });
}

function drawExchange(playerId: number, ctx: RuleContext): void {
  drawAndResolve<PanierState, (typeof PANIER_EXCHANGES)[number]>(ctx, {
    deckId: 'exchanges',
    playerId,
    automatic: false,
    recycle: true,
    discard: true,
    resolve: (exchange) => ctx.effects.schedule(...exchange.effects),
  });
}

function requestCardDraw(
  playerId: number,
  deckId: PendingCardDraw['deckId'],
  ctx: RuleContext,
): void {
  ctx.turn.flags.set(PENDING_CARD_DRAW_FLAG, { playerId, deckId });
}

export function requestStrategicSwap(
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  requestTake(actorId, targetId, ctx);
}

function requestTake(
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const targetCards = ctx.inventory.items(INVENTORY, targetId);
  if (targetCards.length === 0) return;
  const pending: PanierPending = {
    panierKind: 'take',
    actorId,
    targetId,
  };
  ctx.choice.one({
    id: 'panier.take',
    player: actorId,
    options: targetCards,
    data: pending,
  });
}

export function requestQuiz(playerId: number, ctx: RuleContext): void {
  const session = ctx.quiz.ask('market-quiz', [playerId]);
  if (!session) return;
  const question = session.question;
  const pending: PanierPending = {
    panierKind: 'quiz',
    actorId: playerId,
    sessionId: session.id,
  };
  ctx.choice.one({
    id: 'panier.quiz',
    player: playerId,
    options: question.choices.map((_, index) => index),
    data: pending,
    label: (index) => question.choices[index] ?? String(index),
  });
  ctx.events.message('game.quiz.started', {
    playerId,
    questionId: question.id,
  });
}

function requestDirection(
  playerId: number,
  distance: number,
  ctx: RuleContext,
): void {
  const pending: PanierPending = {
    panierKind: 'direction',
    actorId: playerId,
    distance,
  };
  ctx.choice.one({
    id: 'panier.direction',
    player: playerId,
    options: ['forward', 'backward'],
    data: pending,
  });
}

export function moveToNearestStand(
  state: PanierState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const current = positionOf(ctx, TRACK, playerId);
  for (let distance = 1; distance < PANIER_TILES.length; distance += 1) {
    const index = (current + distance) % PANIER_TILES.length;
    if (PANIER_TILES[index].type === 'stand') {
      moveAndResolve(state, playerId, distance, depth, ctx);
      return;
    }
  }
}

function checkVictory(playerId: number, ctx: RuleContext): void {
  const complete = ctx.inventory
    .items(SHOPPING_LISTS, playerId)
    .every((item) => ctx.inventory.has(BASKETS, playerId, item));
  if (complete && ctx.score.get(playerId) > 0) {
    ctx.match.finish({ winners: [playerId], reason: 'shopping-complete' });
  }
}

function finishResolution(ctx: RuleContext): void {
  if (
    ctx.choice.current() ||
    ctx.effects.isResolving() ||
    ctx.turn.flags.get(PENDING_CARD_DRAW_FLAG) != null ||
    ctx.match.lifecycle() === 'finished' ||
    !ctx.turn.flags.consume(RESOLVING_PLAYER_FLAG)
  )
    return;
  ctx.turn.end();
}
