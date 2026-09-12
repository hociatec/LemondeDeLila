import type { CarAssemblyProgram } from '../../contracts/car-assembly-program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { when } from '../../automation/automatic-kit';
import { discardCard } from './card-actions.recipes';
import { drawForPlayer } from './card-dice.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

export function carAssemblyRules(source: CarAssemblyProgram) {
  const program = structuredClone(source);
  const cards = new Map(program.cards.map((card) => [card.id, card]));
  const playable = (playerId: number, ctx: Context) =>
    ctx.cards
      .hand<string>(program.handId, playerId)
      .filter(
        (cardId) =>
          cards.get(cardId)?.category ===
          requiredCategory(program, playerId, ctx),
      );
  return {
    play: defineAction<State, { cardId: string }>({
      input: gameInput.object({ cardId: gameInput.cardId() }),
      validate: ({ actor, input, ctx }) =>
        playable(actor.id, ctx).includes(input.cardId),
      enumerate: ({ actor, ctx }) =>
        playable(actor.id, ctx).map((cardId) => ({ cardId })),
      execute: ({ actor, input, ctx }) => {
        ctx.cards.take(program.handId, actor.id, input.cardId);
        ctx.inventory.add(program.currentInventoryId, actor.id, input.cardId);
        ctx.events.message('game.card.played', {
          playerId: actor.id,
          cardId: input.cardId,
        });
        if (
          ctx.inventory.count(program.currentInventoryId, actor.id) >=
          program.categoryOrder.length
        )
          completeCar(program, actor.id, ctx);
        if (ctx.match.lifecycle() !== 'finished') ctx.turn.complete();
      },
      documentation: 'Pose la pièce correspondant à l’étape actuelle.',
    }),
    discard: discardCard<State>({
      deckId: program.deckId,
      handId: program.handId,
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
    pass: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => {
        ctx.events.message(`${program.eventNamespace}.parts.kept`, {
          playerId: actor.id,
        });
        ctx.turn.complete();
      },
    }),
    automatic: [
      when<State>(
        'draw-car-part',
        ({ ctx }) =>
          ctx.effects.sourcePlayerId() !== (ctx.players.current()?.id ?? null),
        ({ ctx }) => drawCarPart(program, ctx),
      ),
    ],
    viewExtension: ({ ctx }: { ctx: Context }) => ({
      progress: ctx.players.byId((player) => progress(program, player.id, ctx)),
    }),
    playable,
  };
}

function requiredCategory(
  program: CarAssemblyProgram,
  playerId: number,
  ctx: Context,
): string | undefined {
  return program.categoryOrder[
    ctx.inventory.count(program.currentInventoryId, playerId) %
      program.categoryOrder.length
  ];
}

function drawnCardId(ctx: Context): string | null {
  const cardId = ctx.effects.source()?.cardId;
  return typeof cardId === 'string' ? cardId : null;
}

function drawCarPart(program: CarAssemblyProgram, ctx: Context): void {
  const current = ctx.players.current();
  if (!current) return;
  const cardId = drawForPlayer<State, string>(ctx, {
    deckId: program.deckId,
    handId: program.handId,
    playerId: current.id,
    recycle: true,
  })[0];
  if (cardId)
    ctx.events.message('game.card.drawn', {
      playerId: current.id,
      cardId,
      deckId: program.deckId,
    });
}

function completeCar(
  program: CarAssemblyProgram,
  playerId: number,
  ctx: Context,
): void {
  const completed = ctx.resources.get(playerId, program.completedCountResource);
  const inventoryId = program.completedInventoryIds[completed];
  const nameResource = program.completedNameResources[completed];
  if (!inventoryId || !nameResource)
    return ctx.reject('CAR_COMPLETION_SLOT_MISSING', { playerId, completed });
  const parts = [...ctx.inventory.items(program.currentInventoryId, playerId)];
  for (const cardId of parts) {
    ctx.inventory.remove(program.currentInventoryId, playerId, cardId);
    ctx.inventory.add(inventoryId, playerId, cardId);
  }
  const nameIndex =
    ctx.counters.get(program.carNameCounter) % program.carNames.length;
  ctx.resources.set(playerId, nameResource, nameIndex);
  ctx.resources.set(playerId, program.completedCountResource, completed + 1);
  ctx.counters.set(
    program.carNameCounter,
    (nameIndex + 1) % program.carNames.length,
  );
  ctx.events.message(`${program.eventNamespace}.car.completed`, {
    playerId,
    carNameIndex: nameIndex,
  });
  if (completed + 1 >= program.carsToWin)
    ctx.match.finish({ winners: [playerId], reason: program.finishReason });
}

function progress(program: CarAssemblyProgram, playerId: number, ctx: Context) {
  const carParts = [
    ...ctx.inventory.items(program.currentInventoryId, playerId),
  ];
  const count = ctx.resources.get(playerId, program.completedCountResource);
  return {
    stageIndex: carParts.length,
    carParts,
    completedCars: program.completedInventoryIds
      .slice(0, count)
      .map((id, index) => {
        const nameIndex = ctx.resources.get(
          playerId,
          program.completedNameResources[index] ?? '',
        );
        const definition = program.carNames[nameIndex];
        return {
          name: definition?.name ?? '',
          description: definition?.description ?? '',
          parts: [...ctx.inventory.items(id, playerId)],
        };
      }),
  };
}
