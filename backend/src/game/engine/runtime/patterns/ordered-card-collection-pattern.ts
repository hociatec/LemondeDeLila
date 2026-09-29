import { defineAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameContext } from '../definitions/game-author-context';
import { playCard } from '../recipes/gameplay-recipes';
import { definePattern } from './gameplay-pattern-core';
import { clockwise } from '../kits/turn-kit';
import type { GameEffectInstruction } from '../contracts/effect-ir';

export type OrderedCardCollectionOptions = {
  playRecipe: string;
  passRecipe: string;
  deckId: string;
  handId: string;
  cards: readonly {
    id: string;
    name: string;
    value: string;
    special: boolean;
  }[];
  sequence: readonly string[];
  rewards: Readonly<Record<string, Readonly<Record<string, number>>>>;
  resourceValues: Readonly<Record<string, number>>;
  finishReason: string;
  eventNamespace: string;
};

export function orderedCardCollection<TState extends object>(
  source: OrderedCardCollectionOptions,
) {
  const options = structuredClone(source);
  const cards = new Map(options.cards.map((card) => [card.id, card]));
  const expected = (ctx: GameContext<TState>) =>
    options.sequence[ctx.cards.discardCount(options.deckId)];
  const playable = (playerId: number, ctx: GameContext<TState>) =>
    ctx.cards
      .hand<string>(options.handId, playerId)
      .filter((cardId) => cards.get(cardId)?.value === expected(ctx));
  return definePattern({
    id: `ordered-card-collection:${options.deckId}`,
    mechanics: ['cards', 'ordered-collection', 'resources'],
    turn: clockwise(),
    actions: {
      [options.playRecipe]: playCard<TState>({
        deckId: options.deckId,
        handId: options.handId,
        validate: ({ actor, input, ctx }) =>
          ctx.cards
            .hand<string>(options.handId, actor.id)
            .includes(input.cardId) &&
          cards.get(input.cardId)?.value === expected(ctx),
        enumerate: ({ actor, ctx }) =>
          playable(actor.id, ctx).map((cardId) => ({ cardId })),
        afterPlay: ({ playerId, cardId, ctx }) => {
          const card = cards.get(cardId);
          if (!card) return ctx.reject('UNKNOWN_ORDERED_COLLECTION_CARD');
          ctx.events.message('game.card.played', {
            playerId,
            cardId,
            value: card.value,
          });
          const reward = options.rewards[card.value];
          if (!reward) return;
          ctx.effects.run(...rewardEffects(reward, playerId));
          ctx.events.message(`${options.eventNamespace}.candies.won`, {
            playerId,
            score: rewardScore(options, reward),
            candies: reward,
          });
        },
      }),
      [options.passRecipe]: defineAction<TState, Record<string, never>>({
        input: gameInput.object({}),
        execute: ({ actor, ctx }) => {
          ctx.events.message('game.player.passed', { playerId: actor.id });
          ctx.turn.end();
        },
      }),
    },
    victory: {
      evaluate: ({ ctx }) => {
        const complete =
          ctx.cards.discardCount(options.deckId) >= options.sequence.length ||
          ctx.players
            .all()
            .every(
              (player) =>
                ctx.cards.hand(options.handId, player.id).length === 0,
            );
        return complete
          ? {
              winnerPlayerIds: winners(options, ctx),
              reason: options.finishReason,
            }
          : null;
      },
    },
  });
}

function rewardEffects(
  reward: Readonly<Record<string, number>>,
  playerId: number,
): GameEffectInstruction[] {
  const target = { kind: 'player' as const, playerId };
  return Object.entries(reward).map(([resource, amount]) =>
    amount >= 0
      ? { kind: 'gain-resource', resource, amount, target }
      : {
          kind: 'lose-resource',
          resource,
          amount: -amount,
          target,
          insufficient: 'debt',
        },
  );
}

function rewardScore(
  options: OrderedCardCollectionOptions,
  reward: Readonly<Record<string, number>>,
): number {
  return Object.entries(reward).reduce(
    (total, [resource, amount]) =>
      total + amount * (options.resourceValues[resource] ?? 0),
    0,
  );
}

function winners<TState extends object>(
  options: OrderedCardCollectionOptions,
  ctx: GameContext<TState>,
): number[] {
  return ctx.ranking.leaders(
    ctx.players.all().map((player) => player.id),
    {
      value: (playerId) =>
        Object.entries(options.resourceValues).reduce(
          (total, [resource, value]) =>
            total + ctx.resources.get(playerId, resource) * value,
          0,
        ),
    },
  );
}
