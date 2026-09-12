import type { ParadeProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { victoryWhen } from '../../automation/automatic-kit';
import { playCard } from '../../recipes/gameplay/card-actions.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

export function paradeRules(source: ParadeProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const expected = (ctx: Context) =>
    program.sequence[ctx.cards.discardCount(program.deckId)];
  const playable = (playerId: number, ctx: Context) =>
    ctx.cards
      .hand<string>(program.handId, playerId)
      .filter((cardId) => cards.get(cardId)?.value === expected(ctx));
  return {
    play: playCard<State>({
      deckId: program.deckId,
      handId: program.handId,
      validate: ({ actor, input, ctx }) =>
        ctx.cards
          .hand<string>(program.handId, actor.id)
          .includes(input.cardId) &&
        cards.get(input.cardId)?.value === expected(ctx),
      enumerate: ({ actor, ctx }) =>
        playable(actor.id, ctx).map((cardId) => ({ cardId })),
      afterPlay: ({ playerId, cardId, ctx }) => {
        const card = cards.get(cardId);
        if (!card) return ctx.reject('UNKNOWN_PARADE_CARD', { cardId });
        ctx.events.message('game.card.played', {
          playerId,
          cardId,
          value: card.value,
        });
        const reward = program.rewards[card.value];
        if (!reward) return;
        for (const [resource, amount] of Object.entries(reward))
          ctx.resources.add(playerId, resource, amount);
        ctx.events.message(`${program.eventNamespace}.candies.won`, {
          playerId,
          score: rewardScore(program, reward),
          candies: reward,
        });
      },
    }),
    pass: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => {
        ctx.events.message('game.player.passed', { playerId: actor.id });
        ctx.turn.end();
      },
    }),
    victory: victoryWhen<State>(({ ctx }) => {
      const complete =
        ctx.cards.discardCount(program.deckId) >= program.sequence.length ||
        ctx.players
          .all()
          .every(
            (player) => ctx.cards.hand(program.handId, player.id).length === 0,
          );
      return complete
        ? {
            winnerPlayerIds: winners(program, ctx),
            reason: program.finishReason,
          }
        : null;
    }),
    playable,
  };
}
function rewardScore(
  program: ParadeProgram,
  reward: Readonly<Record<string, number>>,
): number {
  return Object.entries(reward).reduce(
    (total, [resource, amount]) =>
      total + amount * (program.resourceValues[resource] ?? 0),
    0,
  );
}

function winners(program: ParadeProgram, ctx: Context): number[] {
  return ctx.ranking.leaders(
    ctx.players.all().map((player) => player.id),
    {
      value: (playerId) =>
        Object.entries(program.resourceValues).reduce(
          (total, [resource, value]) =>
            total + ctx.resources.get(playerId, resource) * value,
          0,
        ),
    },
  );
}
