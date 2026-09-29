import { gameInput } from '../actions/game-input-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import { defineEffect } from '../effects/effects-core';
import { drawAndResolve, raceTurn } from '../recipes/gameplay-recipes';
import { definePattern } from './gameplay-pattern-core';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = {
  id: string | number;
  effects: readonly GameEffectInstruction[];
};

export type TreasureTrackRaceOptions = {
  rollRecipe: string;
  trackId: string;
  diceId: string;
  tiles: readonly {
    n: number;
    title: string;
    description: string;
    type: string;
  }[];
  tileRules: Readonly<
    Record<
      string,
      {
        kind: 'none' | 'draw' | 'gain' | 'finish';
        deck?: string;
        amount?: number;
      }
    >
  >;
  deckRules: Readonly<
    Record<string, { resolveEffects: boolean; protected: boolean }>
  >;
  victoryCollection: string;
  decks: Readonly<Record<string, string>>;
  inventories: Readonly<Record<string, string>>;
  goldResource: string;
  obstacleImmunityStatus: string;
  collectionLimit: number;
  requiredTreasures: number;
  requiredGold: number;
  retreatSpaces: number;
  finishReason: string;
  stealEffectId: string;
  eventNamespace: string;
};

export function treasureTrackRace(source: TreasureTrackRaceOptions) {
  const program = structuredClone(source);
  return definePattern({
    id: `treasure-track-race:${program.trackId}`,
    mechanics: ['race', 'cards', 'collection', 'resources', 'effects'],
    actions: {
      [program.rollRecipe]: raceTurn<State>({
        trackId: program.trackId,
        diceId: program.diceId,
        resolveLanding: ({ playerId, ctx }) =>
          resolveLanding(program, playerId, ctx),
      }),
    },
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
  });
}

function resolveLanding(
  program: TreasureTrackRaceOptions,
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
      const rule = program.tileRules[tile.type];
      if (rule.kind === 'draw' && rule.deck)
        resolveCard(program, playerId, rule.deck, ctx);
      else if (rule.kind === 'gain')
        ctx.resources.add(playerId, program.goldResource, rule.amount ?? 0);
      else if (rule.kind === 'finish') finishOrRetreat(program, playerId, ctx);
    },
  });
}

function resolveCard(
  program: TreasureTrackRaceOptions,
  playerId: number,
  kind: string,
  ctx: Context,
): void {
  drawAndResolve<State, Card>(ctx, {
    deckId: program.decks[kind],
    playerId,
    recycle: true,
    discard: true,
    resolve: (card) => {
      addToCollection(program, playerId, kind, card, ctx);
      const rule = program.deckRules[kind];
      if (
        rule.resolveEffects &&
        (!rule.protected || !consumeImmunity(program, playerId, ctx))
      )
        ctx.effects.schedule(...card.effects);
      else if (rule.resolveEffects && rule.protected)
        ctx.events.message(`${program.eventNamespace}.obstacle.ignored`, {
          playerId,
          cardId: card.id,
        });
    },
  });
}

function addToCollection(
  program: TreasureTrackRaceOptions,
  playerId: number,
  kind: string,
  card: Card,
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
  program: TreasureTrackRaceOptions,
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
  program: TreasureTrackRaceOptions,
  playerId: number,
  ctx: Context,
): void {
  const treasures = ctx.inventory.items(
    program.inventories[program.victoryCollection],
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
  program: TreasureTrackRaceOptions,
  actorId: number,
  targetId: number,
  ctx: Context,
): void {
  const inventoryId = program.inventories[program.victoryCollection];
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
