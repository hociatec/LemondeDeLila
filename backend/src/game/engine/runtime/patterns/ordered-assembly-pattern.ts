import { defineAction, defineEmptyAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { when } from '../automation/automatic-kit';
import type { GameContext } from '../definitions/game-author-context';
import { discardCard, drawForPlayer } from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';

export type OrderedAssemblyOptions = {
  playRecipe: string;
  discardRecipe: string;
  passRecipe: string;
  playAction: string;
  passAction: string;
  deckId: string;
  handId: string;
  currentInventoryId: string;
  completedInventoryIds: readonly string[];
  completedNameResources: readonly string[];
  completedCountResource: string;
  nameCounter: string;
  cards: readonly { id: string; name: string; category: string }[];
  categoryOrder: readonly string[];
  names: readonly { name: string; description: string }[];
  setsToWin: number;
  finishReason: string;
  eventNamespace: string;
};

type State = Record<string, never>;
type Context = GameContext<State>;

export function orderedAssembly(source: OrderedAssemblyOptions) {
  const options = structuredClone(source);
  const cards = new Map(options.cards.map((card) => [card.id, card]));
  const playable = (playerId: number, ctx: Context) =>
    ctx.cards
      .hand<string>(options.handId, playerId)
      .filter(
        (cardId) =>
          cards.get(cardId)?.category === requiredCategory(playerId, ctx),
      );
  const requiredCategory = (playerId: number, ctx: Context) =>
    options.categoryOrder[
      ctx.inventory.count(options.currentInventoryId, playerId) %
        options.categoryOrder.length
    ];
  const drawnCardId = (ctx: Context) => {
    const cardId = ctx.effects.source()?.cardId;
    return typeof cardId === 'string' ? cardId : null;
  };
  return definePattern({
    id: `ordered-assembly:${options.deckId}`,
    mechanics: ['cards', 'ordered-collection', 'inventory', 'resources'],
    actions: {
      [options.playRecipe]: defineAction<State, { cardId: string }>({
        input: gameInput.object({ cardId: gameInput.cardId() }),
        validate: ({ actor, input, ctx }) =>
          playable(actor.id, ctx).includes(input.cardId),
        enumerate: ({ actor, ctx }) =>
          playable(actor.id, ctx).map((cardId) => ({ cardId })),
        execute: ({ actor, input, ctx }) => {
          ctx.cards.take(options.handId, actor.id, input.cardId);
          ctx.inventory.add(options.currentInventoryId, actor.id, input.cardId);
          ctx.events.message('game.card.played', {
            playerId: actor.id,
            cardId: input.cardId,
          });
          if (
            ctx.inventory.count(options.currentInventoryId, actor.id) >=
            options.categoryOrder.length
          )
            completeSet(options, actor.id, ctx);
          if (ctx.match.lifecycle() !== 'finished') ctx.turn.complete();
        },
      }),
      [options.discardRecipe]: discardCard<State>({
        deckId: options.deckId,
        handId: options.handId,
        available: ({ actor, ctx }) =>
          ctx.effects.sourcePlayerId() === actor.id && drawnCardId(ctx) != null,
        validate: ({ input, ctx }) => drawnCardId(ctx) === input.cardId,
        enumerate: ({ ctx }) => {
          const cardId = drawnCardId(ctx);
          return cardId ? [{ cardId }] : [];
        },
        afterDiscard: ({ playerId, ctx }) =>
          ctx.events.message('game.card.discarded', { playerId }),
      }),
      [options.passRecipe]: defineEmptyAction<State>({
        execute: ({ actor, ctx }) => {
          ctx.events.message(`${options.eventNamespace}.parts.kept`, {
            playerId: actor.id,
          });
          ctx.turn.complete();
        },
      }),
    },
    automatic: [
      when<State>(
        'draw-assembly-part',
        ({ ctx }) =>
          ctx.effects.sourcePlayerId() !== (ctx.players.current()?.id ?? null),
        ({ ctx }) => {
          const current = ctx.players.current();
          if (!current) return;
          const cardId = drawForPlayer<State, string>(ctx, {
            deckId: options.deckId,
            handId: options.handId,
            playerId: current.id,
            recycle: true,
          })[0];
          if (cardId)
            ctx.events.message('game.card.drawn', {
              playerId: current.id,
              cardId,
              deckId: options.deckId,
            });
        },
      ),
    ],
    viewExtension: ({ ctx }) => ({
      progress: ctx.players.byId((player) => progress(options, player.id, ctx)),
    }),
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const cardId = playable(actor.id, ctx)[0];
        const action = cardId ? options.playAction : options.passAction;
        return availableActions.includes(action)
          ? { type: action, payload: cardId ? { cardId } : {} }
          : null;
      },
    },
  });
}

function completeSet(
  options: OrderedAssemblyOptions,
  playerId: number,
  ctx: Context,
) {
  const completed = ctx.resources.get(playerId, options.completedCountResource);
  const inventoryId = options.completedInventoryIds[completed];
  const nameResource = options.completedNameResources[completed];
  if (!inventoryId || !nameResource)
    return ctx.reject('ASSEMBLY_COMPLETION_SLOT_MISSING', {
      playerId,
      completed,
    });
  for (const cardId of ctx.inventory.items(
    options.currentInventoryId,
    playerId,
  )) {
    ctx.inventory.remove(options.currentInventoryId, playerId, cardId);
    ctx.inventory.add(inventoryId, playerId, cardId);
  }
  const nameIndex =
    ctx.counters.get(options.nameCounter) % options.names.length;
  ctx.resources.set(playerId, nameResource, nameIndex);
  ctx.resources.set(playerId, options.completedCountResource, completed + 1);
  ctx.counters.set(options.nameCounter, (nameIndex + 1) % options.names.length);
  ctx.events.message(`${options.eventNamespace}.car.completed`, {
    playerId,
    carNameIndex: nameIndex,
  });
  if (completed + 1 >= options.setsToWin)
    ctx.match.finish({ winners: [playerId], reason: options.finishReason });
}

function progress(
  options: OrderedAssemblyOptions,
  playerId: number,
  ctx: Context,
) {
  const parts = [...ctx.inventory.items(options.currentInventoryId, playerId)];
  const count = ctx.resources.get(playerId, options.completedCountResource);
  return {
    stageIndex: parts.length,
    carParts: parts,
    completedCars: options.completedInventoryIds
      .slice(0, count)
      .map((id, index) => {
        const nameIndex = ctx.resources.get(
          playerId,
          options.completedNameResources[index] ?? '',
        );
        const definition = options.names[nameIndex];
        return {
          name: definition?.name ?? '',
          description: definition?.description ?? '',
          parts: [...ctx.inventory.items(id, playerId)],
        };
      }),
  };
}
