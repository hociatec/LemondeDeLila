import {
  defineAction,
  discardCard as discardCardAction,
  gameInput,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import {
  PIMP_MY_RIDE_CARD_BY_ID,
  PIMP_MY_RIDE_CAR_NAMES,
  PIMP_MY_RIDE_CATEGORY_ORDER,
} from './content';
import type { PimpMyRideState } from './state';

const DECK = 'car-parts';
const HANDS = 'players';
const DRAWN_PLAYER_FLAG = 'pimp-my-ride.drawn-player-id';
const DRAWN_CARD_FLAG = 'pimp-my-ride.drawn-card-id';
const CAR_PARTS = 'pimp-my-ride.car-parts';
export const PIMP_CAR_NAME_INDEX = 'pimp-my-ride.car-name-index';
type RuleContext = GameContext<PimpMyRideState>;

export const playCard = defineAction<PimpMyRideState, { cardId: string }>({
  input: gameInput.object({ cardId: gameInput.cardId() }),
  documentation: 'Pose la pièce correspondant à l’étape actuelle.',
  validate: ({ actor, input, ctx }) =>
    ctx.cards.hand<string>(HANDS, actor.id).includes(input.cardId) &&
    PIMP_MY_RIDE_CARD_BY_ID[input.cardId]?.category ===
      requiredCategory(actor.id, ctx),
  enumerate: ({ actor, ctx }) =>
    ctx.cards
      .hand<string>(HANDS, actor.id)
      .filter(
        (cardId) =>
          PIMP_MY_RIDE_CARD_BY_ID[cardId]?.category ===
          requiredCategory(actor.id, ctx),
      )
      .map((cardId) => ({ cardId })),
  execute: ({ state, actor, input, ctx }) => {
    ctx.cards.take(HANDS, actor.id, input.cardId);
    ctx.inventory.add(CAR_PARTS, actor.id, input.cardId);
    ctx.events.message('game.card.played', {
      playerId: actor.id,
      cardId: input.cardId,
    });
    if (ctx.inventory.count(CAR_PARTS, actor.id) >= PIMP_MY_RIDE_CATEGORY_ORDER.length) {
      completeCar(state, actor.id, ctx);
    }
    ctx.turn.complete();
  },
});

export const discardCard = discardCardAction<PimpMyRideState>({
  deckId: DECK,
  handId: HANDS,
  available: ({ actor, ctx }) =>
    drawnPlayerId(ctx) === actor.id && drawnCardId(ctx) != null,
  validate: ({ input, ctx }) => drawnCardId(ctx) === input.cardId,
  enumerate: ({ ctx }) => {
    const cardId = drawnCardId(ctx);
    return cardId ? [{ cardId }] : [];
  },
  afterDiscard: ({ playerId, ctx }) => {
    ctx.events.message('game.card.discarded', { playerId });
  },
});

export const pass = defineAction<PimpMyRideState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Garde la carte piochée et termine le tour.',
  execute: ({ state, actor, ctx }) => {
    ctx.events.message('pimp-my-ride.parts.kept', { playerId: actor.id });
    ctx.turn.complete();
  },
});

export const PIMP_MY_RIDE_ACTIONS = {
  play_card: playCard,
  discard_card: discardCard,
  pass,
};

export function drawCarPart(_state: PimpMyRideState, ctx: RuleContext): void {
  const current = ctx.players.current();
  if (!current) return;
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  ctx.turn.flags.set(DRAWN_PLAYER_FLAG, current.id);
  if (cardId) ctx.turn.flags.set(DRAWN_CARD_FLAG, cardId);
  if (cardId) {
    ctx.cards.give(HANDS, current.id, cardId);
    ctx.events.message('game.card.drawn', {
      playerId: current.id,
      cardId,
      deckId: DECK,
    });
  }
}

function requiredCategory(playerId: number, ctx: RuleContext) {
  return PIMP_MY_RIDE_CATEGORY_ORDER[
    ctx.inventory.count(CAR_PARTS, playerId) % PIMP_MY_RIDE_CATEGORY_ORDER.length
  ];
}

function completeCar(
  state: PimpMyRideState,
  playerId: number,
  ctx: RuleContext,
): void {
  const parts = [...ctx.inventory.items(CAR_PARTS, playerId)];
  const nameIndex =
    ctx.counters.get(PIMP_CAR_NAME_INDEX) % PIMP_MY_RIDE_CAR_NAMES.length;
  state.completedCars[playerId].push({
    nameIndex,
    parts,
  });
  for (const cardId of parts) ctx.inventory.remove(CAR_PARTS, playerId, cardId);
  ctx.counters.set(
    PIMP_CAR_NAME_INDEX,
    (nameIndex + 1) % PIMP_MY_RIDE_CAR_NAMES.length,
  );
  ctx.events.message('pimp-my-ride.car.completed', {
    playerId,
    carNameIndex: nameIndex,
  });
  if (state.completedCars[playerId].length >= 3) {
    ctx.match.finish({ winners: [playerId], reason: 'three-cars' });
  }
}

export function drawnPlayerId(ctx: RuleContext): number | null {
  return ctx.turn.flags.get<number>(DRAWN_PLAYER_FLAG);
}

export function drawnCardId(ctx: RuleContext): string | null {
  return ctx.turn.flags.get<string>(DRAWN_CARD_FLAG);
}

export function currentCarParts(
  playerId: number,
  ctx: RuleContext,
): string[] {
  return [...ctx.inventory.items(CAR_PARTS, playerId)];
}
