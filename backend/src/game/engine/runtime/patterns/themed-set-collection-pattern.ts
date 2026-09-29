import { discardCard } from '../recipes/gameplay-recipes';
import { gameInput } from '../actions/game-input-schema';
import { defineAction, defineEmptyAction } from '../actions/action-builders';
import { definePattern } from './gameplay-pattern-core';
import { drawCardsAtTurnStart } from './gameplay-pattern-track-card';

export type ThemedSetCollectionOptions = {
  formRecipe: string;
  discardRecipe: string;
  passRecipe: string;
  formAction: string;
  discardAction: string;
  passAction: string;
  deckId: string;
  handId: string;
  inventoryId: string;
  cards: readonly { id: string; name: string; theme: string }[];
  themes: readonly string[];
  cardsPerCircle: number;
  circlesToWin: number;
  handMinimum: number;
  handLimit: number;
  finishReason: string;
  eventNamespace: string;
};

type State = Record<string, never>;

export function themedSetCollection(source: ThemedSetCollectionOptions) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const circles = (hand: readonly string[]) =>
    completeCircles(program, cards, hand);
  const discard = discardCard<State>({
    deckId: program.deckId,
    handId: program.handId,
    endTurn: false,
    afterDiscard: ({ playerId, cardId, ctx }) =>
      ctx.events.message('game.card.discarded', { playerId, cardId }),
  });
  const form = defineAction<State, { cardIds: string[] }>({
    input: gameInput.object({
      cardIds: gameInput.array(gameInput.cardId(), {
        min: program.cardsPerCircle,
        max: program.cardsPerCircle,
      }),
    }),
    available: ({ actor, ctx }) =>
      ctx.cards.hand(program.handId, actor.id).length <= program.handLimit &&
      circles(ctx.cards.hand<string>(program.handId, actor.id)).length > 0,
    validate: ({ actor, input, ctx }) =>
      circles(ctx.cards.hand<string>(program.handId, actor.id)).some(
        (candidate) =>
          candidate.length === input.cardIds.length &&
          candidate.every((cardId) => input.cardIds.includes(cardId)),
      ),
    enumerate: ({ actor, ctx }) =>
      circles(ctx.cards.hand<string>(program.handId, actor.id)).map(
        (cardIds) => ({ cardIds }),
      ),
    execute: ({ actor, input, ctx }) => {
      for (const cardId of input.cardIds) {
        ctx.cards.take(program.handId, actor.id, cardId);
        ctx.inventory.add(program.inventoryId, actor.id, cardId);
      }
      const count = Math.floor(
        ctx.inventory.count(program.inventoryId, actor.id) /
          program.cardsPerCircle,
      );
      ctx.cards.drawManyToHand(
        program.deckId,
        program.handId,
        actor.id,
        Math.max(
          0,
          program.handMinimum - ctx.cards.hand(program.handId, actor.id).length,
        ),
        { recycle: true },
      );
      ctx.events.message(`${program.eventNamespace}.circle.completed`, {
        playerId: actor.id,
        circleNumber: count,
      });
      if (count >= program.circlesToWin)
        ctx.match.finish({
          winners: [actor.id],
          reason: program.finishReason,
        });
      else ctx.turn.complete();
    },
    documentation: 'Pose exactement une carte de chaque thème.',
  });
  const pass = defineEmptyAction<State>({
    available: ({ actor, ctx }) =>
      ctx.cards.hand(program.handId, actor.id).length <= program.handLimit,
    execute: ({ actor, ctx }) => {
      ctx.events.message('game.player.passed', { playerId: actor.id });
      ctx.turn.complete();
    },
  });
  return definePattern({
    id: `themed-set-collection:${program.deckId}`,
    mechanics: ['cards', 'collection', 'inventory', 'hand-limit'],
    actions: {
      [program.formRecipe]: form,
      [program.discardRecipe]: discard,
      [program.passRecipe]: pass,
    },
    lifecycle: {
      beforeTurn: drawCardsAtTurnStart<State, string>({
        deckId: program.deckId,
        handId: program.handId,
        afterDraw: ({ player, ctx }) => {
          if (player)
            ctx.events.message('game.card.drawn', {
              playerId: player.id,
              deckId: program.deckId,
            });
        },
      }),
    },
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const circle = circles(
          ctx.cards.hand<string>(program.handId, actor.id),
        )[0];
        const hand = ctx.cards.hand<string>(program.handId, actor.id);
        const action =
          circle && availableActions.includes(program.formAction)
            ? program.formAction
            : hand.length > program.handLimit
              ? program.discardAction
              : program.passAction;
        return availableActions.includes(action)
          ? {
              type: action,
              payload:
                action === program.formAction
                  ? { cardIds: circle }
                  : action === program.discardAction
                    ? { cardId: hand[0] }
                    : {},
            }
          : null;
      },
    },
  });
}
function completeCircles(
  program: ThemedSetCollectionOptions,
  cards: ReadonlyMap<string, { theme: string }>,
  hand: readonly string[],
): string[][] {
  const byTheme = new Map<string, string[]>();
  for (const cardId of hand) {
    const theme = cards.get(cardId)?.theme;
    if (!theme) continue;
    const values = byTheme.get(theme) ?? [];
    values.push(cardId);
    byTheme.set(theme, values);
  }
  if (program.themes.some((theme) => !byTheme.get(theme)?.length)) return [];
  return program.themes.reduce<string[][]>(
    (combinations, theme) =>
      combinations.flatMap((combination) =>
        (byTheme.get(theme) ?? []).map((cardId) => [...combination, cardId]),
      ),
    [[]],
  );
}
