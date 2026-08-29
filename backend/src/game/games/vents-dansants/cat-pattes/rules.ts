import {
  rejectRule,
  completeRound,
  defineAction,
  drawForPlayer,
  gameEffects,
  gameInput,
} from '../../../engine/sdk/public-api';
import type {
  GameContext,
  NoGameState,
  PlayerMap,
} from '../../../engine/sdk/public-api';
import {
  CAT_PATTES_CARD_BY_ID,
  CAT_PATTES_DECK,
  CAT_PATTES_GOAL,
  type CatPattesBotType,
  type CatPattesCardDefinition,
  type CatPattesObstacleType,
  type CatPattesParadeType,
} from './content';
type CatPattesState = NoGameState;

const DECK = 'cat-pattes';
const HANDS = 'players';
const TRACK = 'cat-pattes';
const CAT_STATUS_PREFIX = 'cat-pattes.';
const CAT_OBSTACLE = `${CAT_STATUS_PREFIX}obstacle`;
const CAT_POWER_PREFIX = `${CAT_STATUS_PREFIX}power.`;
const CAT_HAS_SUN = `${CAT_STATUS_PREFIX}has-sun`;
const CAT_SUN_NOT_READY = `${CAT_STATUS_PREFIX}sun-not-ready`;
const CAT_OBSTACLE_LOCK = `${CAT_STATUS_PREFIX}obstacle-lock`;
export const CAT_TURBO_PLAYED = `${CAT_STATUS_PREFIX}turbo-played`;
type RuleContext = GameContext<CatPattesState>;
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
  available: ({ actor, ctx }) => ctx.effects.sourcePlayerId() !== actor.id,
  execute: ({ actor, ctx }) => {
    if (ctx.effects.sourcePlayerId() === actor.id)
      rejectRule('Pioche déjà faite');
    const cardId = drawForPlayer<CatPattesState, string>(ctx, {
      deckId: DECK,
      handId: HANDS,
      playerId: actor.id,
      recycle: true,
    })[0];
    if (cardId) {
      ctx.events.message('game.card.drawn', {
        playerId: actor.id,
        deckId: DECK,
        cardId,
      });
      return;
    }
    if (ctx.cards.hand<string>(HANDS, actor.id).length === 0) {
      ctx.effects.clearSource();
      ctx.events.message('game.player.passed', {
        playerId: actor.id,
        reason: 'no-card',
      });
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
    ctx.effects.sourcePlayerId() === actor.id &&
    playableInputs(state, actor.id, ctx).length > 0,
  validate: ({ state, actor, input, ctx }) =>
    includesInput(playableInputs(state, actor.id, ctx), input),
  enumerate: ({ state, actor, ctx }) => playableInputs(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    if (ctx.effects.sourcePlayerId() !== actor.id) {
      rejectRule('Vous devez piocher avant de jouer');
    }
    if (!includesInput(playableInputs(state, actor.id, ctx), input)) {
      rejectRule('Carte Cat Pattes indisponible');
    }
    const card = CAT_PATTES_CARD_BY_ID[input.cardId];
    ctx.cards.play(HANDS, DECK, actor.id, input.cardId);
    ctx.events.message('game.card.played', {
      playerId: actor.id,
      cardId: card.id,
    });
    ctx.effects.schedule(...effectsForPlay(card, input.targetPlayerId ?? null));
    ctx.effects.clearSource();
  },
});

export const discard = defineAction<CatPattesState, { cardId?: string }>({
  input: gameInput.object({ cardId: gameInput.optional(gameInput.cardId()) }),
  documentation: 'Défausse une carte jouable ou passe avec une main vide.',
  available: ({ state, actor, ctx }) =>
    ctx.effects.sourcePlayerId() === actor.id &&
    !mustCounter(state, actor.id, ctx),
  validate: ({ state, actor, input, ctx }) => {
    if (
      ctx.effects.sourcePlayerId() !== actor.id ||
      mustCounter(state, actor.id, ctx)
    ) {
      return false;
    }
    const hand = ctx.cards.hand<string>(HANDS, actor.id);
    return hand.length === 0
      ? input.cardId == null
      : hand.includes(input.cardId ?? '');
  },
  enumerate: ({ state, actor, ctx }) => {
    if (
      ctx.effects.sourcePlayerId() !== actor.id ||
      mustCounter(state, actor.id, ctx)
    ) {
      return [];
    }
    const hand = ctx.cards.hand<string>(HANDS, actor.id);
    return hand.length === 0 ? [{}] : hand.map((cardId) => ({ cardId }));
  },
  execute: ({ state, actor, input, ctx }) => {
    if (
      ctx.effects.sourcePlayerId() !== actor.id ||
      mustCounter(state, actor.id, ctx)
    ) {
      rejectRule('Défausse Cat Pattes interdite');
    }
    const hand = ctx.cards.hand<string>(HANDS, actor.id);
    const cardId = input.cardId ?? hand[0];
    if (cardId) ctx.cards.play(HANDS, DECK, actor.id, cardId);
    ctx.effects.clearSource();
    ctx.turn.end();
  },
});

export const CAT_PATTES_ACTIONS = {
  draw,
  play_card: playCard,
  discard_card: discard,
};

export function playableInputs(
  _state: CatPattesState,
  actorId: number,
  ctx: RuleContext,
): CardInput[] {
  if (ctx.effects.sourcePlayerId() !== actorId) return [];
  const blocked = isBlocked(actorId, ctx);
  return ctx.cards.hand<string>(HANDS, actorId).flatMap((cardId) => {
    const card = CAT_PATTES_CARD_BY_ID[cardId];
    if (!card || (blocked && card.type !== 'parade' && card.type !== 'bot')) {
      return [];
    }
    if (card.type === 'pattes') {
      return canPlayPattes(actorId, card, ctx) ? [{ cardId }] : [];
    }
    if (card.type === 'obstacle') {
      if (!card.obstacle) return [];
      return ctx.players
        .all()
        .filter(
          (player) =>
            player.id !== actorId &&
            canReceiveObstacle(player.id, card.obstacle!, ctx),
        )
        .map((player) => ({ cardId, targetPlayerId: player.id }));
    }
    if (card.type === 'parade') {
      return canPlayParade(actorId, card, ctx) ? [{ cardId }] : [];
    }
    return canPlayPower(actorId, card, ctx) ? [{ cardId }] : [];
  });
}

function effectsForPlay(
  card: CatPattesCardDefinition,
  targetId: number | null,
): readonly import('../../../engine/sdk/public-api').GameEffectInstruction[] {
  if (card.type !== 'obstacle' || targetId == null) return card.effects;
  return card.effects.map((effect) =>
    effect.kind === 'add-status'
      ? { ...effect, target: gameEffects.target.player(targetId) }
      : effect,
  );
}

export function completeCatPattesRound(
  roundWinnerId: number,
  ctx: RuleContext,
): void {
  completeRound(ctx, {
    winnerPlayerIds: [roundWinnerId],
    next: { starterPlayerId: roundWinnerId },
  });
}

export function resetCatPattesRound(
  _state: CatPattesState,
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
    ctx.movement.moveTo(TRACK, player.id, 0);
    ctx.resources.set(player.id, CAT_TURBO_PLAYED, 0);
    for (const status of ctx.status.list(player.id)) {
      if (status.id.startsWith(CAT_STATUS_PREFIX)) {
        ctx.status.remove(player.id, status.id);
      }
    }
  }
  ctx.cards.deal(
    DECK,
    HANDS,
    ctx.players.all().map((player) => player.id),
    6,
  );
  ctx.turn.flags.clear();
  const starterId = ctx.round.starter();
  if (starterId != null) ctx.turn.to(starterId);
}

export function scoreCatPattesRound(
  _state: CatPattesState,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    ctx.score.add(player.id, ctx.movement.position(TRACK, player.id));
  }
  const roundWinnerId = ctx.round.winners()[0];
  if (roundWinnerId != null) {
    ctx.events.message('game.round.won', {
      playerId: roundWinnerId,
      round: ctx.round.number,
    });
  }
  if (ctx.round.completed() >= (ctx.config.get<number>('roundsToPlay') ?? 1)) {
    const winnerId = [...ctx.players.all()].sort(
      (left, right) =>
        ctx.score.get(right.id) - ctx.score.get(left.id) || left.id - right.id,
    )[0]?.id;
    if (winnerId != null) {
      ctx.match.finish({ winners: [winnerId], reason: 'most-pattes' });
    }
  }
}

function canPlayPattes(
  playerId: number,
  card: CatPattesCardDefinition,
  ctx: RuleContext,
): boolean {
  const passageStar = hasPower(playerId, 'passage-star', ctx);
  const value = card.value ?? 0;
  return (
    (ctx.status.has(playerId, CAT_HAS_SUN) || passageStar) &&
    !isBlocked(playerId, ctx) &&
    value > 0 &&
    ctx.movement.position(TRACK, playerId) + value <= CAT_PATTES_GOAL
  );
}

function canReceiveObstacle(
  playerId: number,
  obstacle: CatPattesObstacleType,
  ctx: RuleContext,
): boolean {
  if (powerIgnoresObstacle(powers(playerId, ctx), obstacle)) return false;
  if (
    ctx.status.has(playerId, CAT_OBSTACLE_LOCK) &&
    !hasPower(playerId, 'passage-star', ctx)
  ) {
    return false;
  }
  return currentObstacle(playerId, ctx) == null;
}

function canPlayParade(
  playerId: number,
  card: CatPattesCardDefinition,
  ctx: RuleContext,
): boolean {
  if (!card.parade) return false;
  if (
    powers(playerId, ctx).some((power) =>
      PARADE_DISABLED_BY_POWER[power].includes(card.parade!),
    )
  ) {
    return false;
  }
  const obstacle = currentObstacle(playerId, ctx);
  return obstacle
    ? OBSTACLE_TO_PARADE[obstacle] === card.parade
    : card.parade === 'rayon' && !ctx.status.has(playerId, CAT_SUN_NOT_READY);
}

function canPlayPower(
  playerId: number,
  card: CatPattesCardDefinition,
  ctx: RuleContext,
): boolean {
  if (!card.bot) return false;
  const obstacle = currentObstacle(playerId, ctx);
  return obstacle == null || powerIgnoresObstacle([card.bot], obstacle);
}

export function applyParade(
  playerId: number,
  parade: CatPattesParadeType,
  ctx: RuleContext,
): void {
  const obstacle = currentObstacle(playerId, ctx);
  const removes = obstacle != null && OBSTACLE_TO_PARADE[obstacle] === parade;
  if (removes) ctx.status.remove(playerId, CAT_OBSTACLE);
  if (parade === 'rayon') {
    addRoundStatus(playerId, CAT_HAS_SUN, ctx);
    addRoundStatus(playerId, CAT_SUN_NOT_READY, ctx);
    ctx.status.remove(playerId, CAT_OBSTACLE_LOCK);
  } else if (removes) {
    ctx.status.remove(playerId, CAT_SUN_NOT_READY);
    addRoundStatus(playerId, CAT_OBSTACLE_LOCK, ctx);
  }
}

export function applyPower(
  playerId: number,
  power: CatPattesBotType,
  ctx: RuleContext,
): void {
  addRoundStatus(playerId, powerStatus(power), ctx);
  const obstacle = currentObstacle(playerId, ctx);
  if (obstacle && powerIgnoresObstacle([power], obstacle)) {
    ctx.status.remove(playerId, CAT_OBSTACLE);
    ctx.status.remove(playerId, CAT_SUN_NOT_READY);
    if (power !== 'passage-star')
      addRoundStatus(playerId, CAT_OBSTACLE_LOCK, ctx);
    else ctx.status.remove(playerId, CAT_OBSTACLE_LOCK);
  }
}

function mustCounter(
  state: CatPattesState,
  playerId: number,
  ctx: RuleContext,
): boolean {
  return (
    isBlocked(playerId, ctx) && playableInputs(state, playerId, ctx).length > 0
  );
}

function isBlocked(playerId: number, ctx: RuleContext): boolean {
  const obstacle = currentObstacle(playerId, ctx);
  return (
    obstacle != null && !powerIgnoresObstacle(powers(playerId, ctx), obstacle)
  );
}

function hasPower(
  playerId: number,
  power: CatPattesBotType,
  ctx: RuleContext,
): boolean {
  return ctx.status.has(playerId, powerStatus(power));
}

function powers(playerId: number, ctx: RuleContext): CatPattesBotType[] {
  return ctx.status
    .list(playerId)
    .filter((status) => status.id.startsWith(CAT_POWER_PREFIX))
    .map((status) => status.id.slice(CAT_POWER_PREFIX.length))
    .filter((power): power is CatPattesBotType =>
      Object.hasOwn(PARADE_DISABLED_BY_POWER, power),
    );
}

function currentObstacle(
  playerId: number,
  ctx: RuleContext,
): CatPattesObstacleType | null {
  const value = ctx.status.get(playerId, CAT_OBSTACLE)?.data.obstacle;
  return isCatPattesObstacle(value) ? value : null;
}

function isCatPattesObstacle(value: unknown): value is CatPattesObstacleType {
  return (
    value === 'gamelle' ||
    value === 'pluie' ||
    value === 'chien' ||
    value === 'coussin' ||
    value === 'sol'
  );
}

function powerStatus(power: CatPattesBotType): string {
  return `${CAT_POWER_PREFIX}${power}`;
}

function addRoundStatus(
  playerId: number,
  statusId: string,
  ctx: RuleContext,
): void {
  ctx.status.add(playerId, statusId, { scope: 'round' });
}

export function catPattesPlayerState(ctx: RuleContext): {
  obstacles: PlayerMap<CatPattesObstacleType | null>;
  powers: PlayerMap<CatPattesBotType[]>;
  turboPlayed: PlayerMap<number>;
  hasSun: PlayerMap<boolean>;
  sunReady: PlayerMap<boolean>;
  obstacleLock: PlayerMap<boolean>;
} {
  return {
    obstacles: ctx.players.byId((player) => currentObstacle(player.id, ctx)),
    powers: ctx.players.byId((player) => powers(player.id, ctx)),
    turboPlayed: ctx.players.byId((player) =>
      ctx.resources.get(player.id, CAT_TURBO_PLAYED),
    ),
    hasSun: ctx.players.byId((player) =>
      ctx.status.has(player.id, CAT_HAS_SUN),
    ),
    sunReady: ctx.players.byId(
      (player) => !ctx.status.has(player.id, CAT_SUN_NOT_READY),
    ),
    obstacleLock: ctx.players.byId((player) =>
      ctx.status.has(player.id, CAT_OBSTACLE_LOCK),
    ),
  };
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

export const CAT_PATTES_CARD_COUNT = CAT_PATTES_DECK.length;
