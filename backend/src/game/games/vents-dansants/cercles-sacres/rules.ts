import {
  defineAction,
  discardCard as discardCardAction,
  drawCardsAtTurnStart,
  gameInput,
} from '../../../core/application/public-api';
import { CERCLES_SACRES_CARD_BY_ID, type CerclesSacresTheme } from './content';
import type { CerclesSacresCircle, CerclesSacresState } from './state';
import type { PlayerMap } from '../../../core/application/public-api';

export const CERCLES_SACRES_GOAL = 3;
export const CERCLES_SACRES_HAND_MIN = 6;
export const CERCLES_SACRES_HAND_LIMIT = 8;
const DECK = 'sacred-circles';
const HANDS = 'players';
const CIRCLES = 'sacred-circles-completed';
const CERCLES_THEMES: readonly CerclesSacresTheme[] = [
  'totem',
  'nature',
  'plante',
  'esprit',
  'parole',
  'nation',
];

export const discardCard = discardCardAction<CerclesSacresState>({
  deckId: DECK,
  handId: HANDS,
  endTurn: false,
  afterDiscard: ({ playerId, cardId, ctx }) => {
    ctx.events.message('game.card.discarded', { playerId, cardId });
  },
});

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
  validate: ({ actor, input, ctx }) =>
    completeCircles(ctx.cards.hand<string>(HANDS, actor.id)).some(
      (circle) =>
        circle.length === input.cardIds.length &&
        circle.every((cardId) => input.cardIds.includes(cardId)),
    ),
  enumerate: ({ actor, ctx }) =>
    completeCircles(ctx.cards.hand<string>(HANDS, actor.id)).map((cardIds) => ({
      cardIds,
    })),
  execute: ({ actor, input, ctx }) => {
    for (const cardId of input.cardIds) ctx.cards.take(HANDS, actor.id, cardId);
    ctx.inventory.add(CIRCLES, actor.id, JSON.stringify(input.cardIds));
    const circleCount = ctx.inventory.count(CIRCLES, actor.id);
    fillHand(actor.id, ctx);
    ctx.events.message('cercles.circle.completed', {
      playerId: actor.id,
      circleNumber: circleCount,
    });
    if (circleCount >= CERCLES_SACRES_GOAL) {
      ctx.match.finish({ winners: [actor.id], reason: 'three-circles' });
      return;
    }
    ctx.turn.complete();
  },
});

export const pass = defineAction<CerclesSacresState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Termine le tour sans former de cercle.',
  available: ({ actor, ctx }) =>
    ctx.cards.hand(HANDS, actor.id).length <= CERCLES_SACRES_HAND_LIMIT,
  execute: ({ state: _state, actor, ctx }) => {
    ctx.events.message('game.player.passed', { playerId: actor.id });
    ctx.turn.complete();
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
  if (CERCLES_THEMES.some((theme) => !byTheme.get(theme)?.length)) return [];
  return CERCLES_THEMES.reduce<string[][]>(
    (combinations, theme) =>
      combinations.flatMap((combination) =>
        (byTheme.get(theme) ?? []).map((cardId) => [...combination, cardId]),
      ),
    [[]],
  );
}

export const drawAtTurnStart = drawCardsAtTurnStart<CerclesSacresState, string>(
  {
    deckId: DECK,
    handId: HANDS,
    afterDraw: ({ player, ctx }) => {
      if (player)
        ctx.events.message('game.card.drawn', {
          playerId: player.id,
          deckId: DECK,
        });
    },
  },
);

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

export function sacredCircles(
  ctx: Parameters<typeof pass.execute>[0]['ctx'],
): PlayerMap<CerclesSacresCircle[]> {
  return ctx.players.byId((player) =>
    ctx.inventory.items(CIRCLES, player.id).flatMap((itemId, index) => {
      const cards = parseCardIds(itemId);
      if (!cards) return [];
      const themes = circleThemes(cards);
      if (!themes) return [];
      return [
        {
          id: `circle-${player.id}-${index + 1}`,
          cards,
          themes,
        },
      ];
    }),
  );
}

function parseCardIds(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((cardId): cardId is string => typeof cardId === 'string')
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function circleThemes(
  cards: readonly string[],
): Record<CerclesSacresTheme, string> | null {
  const byTheme = new Map<CerclesSacresTheme, string>();
  for (const cardId of cards) {
    const card = CERCLES_SACRES_CARD_BY_ID[cardId];
    if (card) byTheme.set(card.theme, cardId);
  }
  const [totem, nature, plante, esprit, parole, nation] = CERCLES_THEMES.map(
    (theme) => byTheme.get(theme),
  );
  if (!totem || !nature || !plante || !esprit || !parole || !nation) {
    return null;
  }
  return { totem, nature, plante, esprit, parole, nation };
}
