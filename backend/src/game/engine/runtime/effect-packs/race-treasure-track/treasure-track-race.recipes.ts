import type {
  TreasureTrackDeckKind,
  TreasureTrackRaceCard,
  TreasureTrackRaceProgram,
} from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEffect } from '../../effects/effects-core';
import { gameInput } from '../../actions/game-input-schema';
import {
  drawAndResolve,
  raceTurn,
} from '../../recipes/gameplay/card-dice.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

export function treasureTrackRaceRules(source: TreasureTrackRaceProgram) {
  const program = structuredClone(source);
  return {
    roll: raceTurn<State>({
      trackId: program.trackId,
      diceId: program.diceId,
      resolveLanding: ({ playerId, ctx }) =>
        resolveLanding(program, playerId, ctx),
    }),
    effects: {
      [program.stealEffectId]: defineEffect<State, Record<string, never>>({
        input: gameInput.object({}),
        apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
          const targetId = targetPlayerIds[0];
          if (actorPlayerId != null && targetId != null)
            stealTreasure(program, actorPlayerId, targetId, ctx);
        },
      }),
    },
  };
}
function resolveLanding(
  program: TreasureTrackRaceProgram,
  playerId: number,
  ctx: Context,
): void {
  ctx.movement.resolveLanding({
    trackId: program.trackId,
    playerId,
    tiles: program.tiles,
    onLand: ({ position, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: position });
      if (isDeckKind(tile.type)) resolveCard(program, playerId, tile.type, ctx);
      else if (tile.type === 'gold')
        ctx.resources.add(playerId, program.goldResource, 1);
      else if (tile.type === 'finish') finishOrRetreat(program, playerId, ctx);
    },
  });
}

function isDeckKind(value: string): value is TreasureTrackDeckKind {
  return value === 'treasure' || value === 'obstacle' || value === 'bonus';
}

function resolveCard(
  program: TreasureTrackRaceProgram,
  playerId: number,
  kind: TreasureTrackDeckKind,
  ctx: Context,
): void {
  drawAndResolve<State, TreasureTrackRaceCard>(ctx, {
    deckId: program.decks[kind],
    playerId,
    recycle: true,
    discard: true,
    resolve: (card) => {
      addToCollection(program, playerId, kind, card, ctx);
      if (kind === 'bonus') ctx.effects.schedule(...card.effects);
      if (kind === 'obstacle' && !consumeImmunity(program, playerId, ctx))
        ctx.effects.schedule(...card.effects);
      else if (kind === 'obstacle')
        ctx.events.message(`${program.eventNamespace}.obstacle.ignored`, {
          playerId,
          cardId: card.id,
        });
    },
  });
}

function addToCollection(
  program: TreasureTrackRaceProgram,
  playerId: number,
  kind: TreasureTrackDeckKind,
  card: TreasureTrackRaceCard,
  ctx: Context,
): void {
  const total = Object.values(program.inventories).reduce(
    (count, inventoryId) =>
      count + ctx.inventory.items(inventoryId, playerId).length,
    0,
  );
  if (total < program.collectionLimit)
    ctx.inventory.add(program.inventories[kind], playerId, String(card.id));
}

function consumeImmunity(
  program: TreasureTrackRaceProgram,
  playerId: number,
  ctx: Context,
): boolean {
  const remaining =
    ctx.status.get(playerId, program.obstacleImmunityStatus)?.remaining ?? 0;
  if (remaining <= 0) return false;
  if (remaining === 1)
    ctx.status.remove(playerId, program.obstacleImmunityStatus);
  else
    ctx.status.add(playerId, program.obstacleImmunityStatus, {
      turns: remaining - 1,
      scope: 'until-used',
    });
  return true;
}

function finishOrRetreat(
  program: TreasureTrackRaceProgram,
  playerId: number,
  ctx: Context,
): void {
  const treasures = ctx.inventory.items(
    program.inventories.treasure,
    playerId,
  ).length;
  if (
    treasures >= program.requiredTreasures ||
    ctx.resources.get(playerId, program.goldResource) >= program.requiredGold
  ) {
    ctx.match.finish({ winners: [playerId], reason: program.finishReason });
    ctx.events.message(`${program.eventNamespace}.chest.opened`, { playerId });
  } else {
    ctx.movement.move(program.trackId, playerId, -program.retreatSpaces);
    ctx.events.message(`${program.eventNamespace}.chest.closed`, {
      playerId,
      retreat: program.retreatSpaces,
    });
  }
}

function stealTreasure(
  program: TreasureTrackRaceProgram,
  actorId: number,
  targetId: number,
  ctx: Context,
): void {
  const inventoryId = program.inventories.treasure;
  const cardId = ctx.inventory.items(inventoryId, targetId).at(-1);
  if (cardId == null) {
    ctx.events.message(`${program.eventNamespace}.treasure.none-to-steal`, {
      actorId,
      targetId,
    });
    return;
  }
  ctx.inventory.transfer(inventoryId, targetId, actorId, cardId);
}
