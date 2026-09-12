import type { CardCirclesProgram } from '../../extensions/card-circles/program';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { discardCard } from './card-actions.recipes';
import { drawCardsAtTurnStart } from '../../patterns/gameplay-pattern-track-card';

type State = Record<string, never>;

export function cardCirclesRules(source: CardCirclesProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const circles = (hand: readonly string[]) =>
    completeCircles(program, cards, hand);
  return {
    discard: discardCard<State>({
      deckId: program.deckId,
      handId: program.handId,
      endTurn: false,
      afterDiscard: ({ playerId, cardId, ctx }) =>
        ctx.events.message('game.card.discarded', { playerId, cardId }),
    }),
    form: defineAction<State, { cardIds: string[] }>({
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
            program.handMinimum -
              ctx.cards.hand(program.handId, actor.id).length,
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
    }),
    pass: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      available: ({ actor, ctx }) =>
        ctx.cards.hand(program.handId, actor.id).length <= program.handLimit,
      execute: ({ actor, ctx }) => {
        ctx.events.message('game.player.passed', { playerId: actor.id });
        ctx.turn.complete();
      },
    }),
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
    circles,
  };
}
function completeCircles(
  program: CardCirclesProgram,
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
