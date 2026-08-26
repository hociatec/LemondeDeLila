import { defineAction, gameInput } from '../../../core/application/public-api';
import { CERCLES_SACRES_CARD_BY_ID, type CerclesSacresTheme } from './content';
import type { CerclesSacresCircle, CerclesSacresState } from './state';

export const CERCLES_SACRES_GOAL = 3;
export const CERCLES_SACRES_HAND_MIN = 6;
export const CERCLES_SACRES_HAND_LIMIT = 8;
const DECK = 'sacred-circles';
const HANDS = 'players';

export const discardCard = defineAction<CerclesSacresState, { cardId: string }>(
  {
    input: gameInput.object({ cardId: gameInput.cardId() }),
    documentation: 'Défausse une carte de sa main, sans terminer le tour.',
    availableInputs: ({ actor, ctx }) =>
      ctx.cards.hand<string>(HANDS, actor.id).map((cardId) => ({ cardId })),
    execute: ({ actor, input, ctx }) => {
      ctx.cards.play(HANDS, DECK, actor.id, input.cardId);
      ctx.history.add(`${actor.username} défausse ${cardName(input.cardId)}.`);
    },
  },
);

export const formCircle = defineAction<
  CerclesSacresState,
  { cardIds: string[] }
>({
  input: gameInput.object({
    cardIds: gameInput.array(gameInput.cardId(), { min: 6, max: 6 }),
  }),
  documentation: 'Pose exactement une carte de chacun des six thèmes.',
  available: ({ actor, ctx }) =>
    ctx.cards.hand(HANDS, actor.id).length <= CERCLES_SACRES_HAND_LIMIT &&
    completeCircles(ctx.cards.hand<string>(HANDS, actor.id)).length > 0,
  availableInputs: ({ actor, ctx }) =>
    completeCircles(ctx.cards.hand<string>(HANDS, actor.id)).map((cardIds) => ({
      cardIds,
    })),
  execute: ({ state, actor, input, ctx }) => {
    for (const cardId of input.cardIds) ctx.cards.take(HANDS, actor.id, cardId);
    const playerCircles = state.circles[actor.id];
    const themes = Object.fromEntries(
      input.cardIds.map((cardId) => [
        CERCLES_SACRES_CARD_BY_ID[cardId].theme,
        cardId,
      ]),
    ) as Record<CerclesSacresTheme, string>;
    const circle: CerclesSacresCircle = {
      id: `circle-${actor.id}-${playerCircles.length + 1}`,
      cards: [...input.cardIds],
      themes,
    };
    playerCircles.push(circle);
    fillHand(actor.id, ctx);
    ctx.history.add(
      `${actor.username} pose son cercle sacré n°${playerCircles.length}.`,
    );
    if (playerCircles.length >= CERCLES_SACRES_GOAL) {
      state.winnerId = actor.id;
      return;
    }
    endTurn(state, ctx);
  },
});

export const pass = defineAction<CerclesSacresState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Termine le tour sans former de cercle.',
  available: ({ actor, ctx }) =>
    ctx.cards.hand(HANDS, actor.id).length <= CERCLES_SACRES_HAND_LIMIT,
  execute: ({ state, actor, ctx }) => {
    ctx.history.add(`${actor.username} passe son tour.`);
    endTurn(state, ctx);
  },
});

export const CERCLES_SACRES_ACTIONS = {
  discard_card: discardCard,
  form_circle: formCircle,
  pass,
};

export function completeCircles(hand: readonly string[]): string[][] {
  const byTheme = new Map<CerclesSacresTheme, string[]>();
  for (const cardId of hand) {
    const card = CERCLES_SACRES_CARD_BY_ID[cardId];
    if (!card) continue;
    const cards = byTheme.get(card.theme) ?? [];
    cards.push(cardId);
    byTheme.set(card.theme, cards);
  }
  const themes: CerclesSacresTheme[] = [
    'totem',
    'nature',
    'plante',
    'esprit',
    'parole',
    'nation',
  ];
  if (themes.some((theme) => !byTheme.get(theme)?.length)) return [];
  return themes.reduce<string[][]>(
    (combinations, theme) =>
      combinations.flatMap((combination) =>
        (byTheme.get(theme) ?? []).map((cardId) => [...combination, cardId]),
      ),
    [[]],
  );
}

export function drawAtTurnStart(
  state: CerclesSacresState,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  const current = ctx.players.current();
  if (!current) return;
  const card = ctx.cards.drawOrRecycle<string>(DECK);
  if (card) {
    ctx.cards.give(HANDS, current.id, card);
    ctx.history.add(`${current.username} pioche une carte.`);
  }
  state.drawnPlayerId = current.id;
}

function fillHand(
  playerId: number,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  while (ctx.cards.hand(HANDS, playerId).length < CERCLES_SACRES_HAND_MIN) {
    const card = ctx.cards.drawOrRecycle<string>(DECK);
    if (!card) return;
    ctx.cards.give(HANDS, playerId, card);
  }
}

function endTurn(
  state: CerclesSacresState,
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): void {
  state.drawnPlayerId = null;
  ctx.turn.end();
}

function cardName(cardId: string): string {
  return CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? cardId;
}
