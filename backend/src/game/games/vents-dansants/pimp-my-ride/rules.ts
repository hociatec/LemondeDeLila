import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  PIMP_MY_RIDE_CARD_BY_ID,
  PIMP_MY_RIDE_CAR_NAMES,
  PIMP_MY_RIDE_CATEGORY_ORDER,
} from './content';
import type { PimpMyRideState } from './state';

const DECK = 'car-parts';
const HANDS = 'players';
type RuleContext = GameRuleContext<PimpMyRideState>;

export const playCard = defineAction<PimpMyRideState, { cardId: string }>({
  input: gameInput.object({ cardId: gameInput.cardId() }),
  documentation: 'Pose la pièce correspondant à l’étape actuelle.',
  availableInputs: ({ state, actor, ctx }) =>
    ctx.cards
      .hand<string>(HANDS, actor.id)
      .filter(
        (cardId) =>
          PIMP_MY_RIDE_CARD_BY_ID[cardId]?.category ===
          requiredCategory(state, actor.id),
      )
      .map((cardId) => ({ cardId })),
  execute: ({ state, actor, input, ctx }) => {
    ctx.cards.take(HANDS, actor.id, input.cardId);
    const progress = state.progress[actor.id];
    progress.carParts.push(input.cardId);
    progress.stageIndex += 1;
    ctx.history.add(
      `${actor.username} pose ${PIMP_MY_RIDE_CARD_BY_ID[input.cardId].name}.`,
    );
    if (progress.stageIndex >= PIMP_MY_RIDE_CATEGORY_ORDER.length) {
      completeCar(state, actor.id, ctx);
    }
    if (state.winnerId == null) endTurn(state, ctx);
  },
});

export const discardCard = defineAction<PimpMyRideState, { cardId: string }>({
  input: gameInput.object({ cardId: gameInput.cardId() }),
  documentation: 'Défausse uniquement la carte piochée ce tour.',
  available: ({ state, actor }) =>
    state.drawnPlayerId === actor.id && state.drawnCardId != null,
  availableInputs: ({ state }) =>
    state.drawnCardId ? [{ cardId: state.drawnCardId }] : [],
  execute: ({ state, actor, input, ctx }) => {
    ctx.cards.play(HANDS, DECK, actor.id, input.cardId);
    ctx.history.add(`${actor.username} défausse cette pièce.`);
    endTurn(state, ctx);
  },
});

export const pass = defineAction<PimpMyRideState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Garde la carte piochée et termine le tour.',
  execute: ({ state, actor, ctx }) => {
    ctx.history.add(`${actor.username} garde ses pièces.`);
    endTurn(state, ctx);
  },
});

export const PIMP_MY_RIDE_ACTIONS = {
  play_card: playCard,
  discard_card: discardCard,
  pass,
};

export function drawCarPart(state: PimpMyRideState, ctx: RuleContext): void {
  const current = ctx.players.current();
  if (!current) return;
  const cardId = ctx.cards.drawOrRecycle<string>(DECK);
  state.drawnPlayerId = current.id;
  state.drawnCardId = cardId;
  if (cardId) {
    ctx.cards.give(HANDS, current.id, cardId);
    ctx.history.add(
      `${current.username} pioche ${PIMP_MY_RIDE_CARD_BY_ID[cardId].name}.`,
    );
  }
}

function requiredCategory(state: PimpMyRideState, playerId: number) {
  return PIMP_MY_RIDE_CATEGORY_ORDER[
    state.progress[playerId].stageIndex % PIMP_MY_RIDE_CATEGORY_ORDER.length
  ];
}

function completeCar(
  state: PimpMyRideState,
  playerId: number,
  ctx: RuleContext,
): void {
  const progress = state.progress[playerId];
  const name =
    PIMP_MY_RIDE_CAR_NAMES[state.carNameIndex % PIMP_MY_RIDE_CAR_NAMES.length];
  progress.completedCars.push({
    name: name.name,
    description: name.description,
    parts: [...progress.carParts],
  });
  progress.stageIndex = 0;
  progress.carParts = [];
  state.carNameIndex = (state.carNameIndex + 1) % PIMP_MY_RIDE_CAR_NAMES.length;
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} termine ${name.name}.`,
  );
  if (progress.completedCars.length >= 3) state.winnerId = playerId;
}

function endTurn(state: PimpMyRideState, ctx: RuleContext): void {
  state.drawnPlayerId = null;
  state.drawnCardId = null;
  ctx.turn.end();
}
