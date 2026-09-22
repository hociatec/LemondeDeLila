import { drawAndResolve, raceTurn } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type {
  TreasureTrackDeckKind,
  TreasureTrackRaceCard,
  TreasureTrackRaceProgram,
} from './program';
import { defineEmptyEffect } from '../../../engine/runtime/effects/effects-core';

type State = Record<string, never>;
type Context = GameContext<State>;

export function treasureTrackRaceRules(source: TreasureTrackRaceProgram) {
  const program = structuredClone(source);
  return {
    roll: raceTurn<State>({
      trackId: program.trackId,
      diceId: program.diceId,
      resolveLanding: ({ playerId, ctx }) => resolveLanding(playerId, ctx),
    }),
    effects: {
      [program.stealEffectId]: defineEmptyEffect<State>(
        ({ actorPlayerId, targetPlayerIds, ctx }) => {
          const targetId = targetPlayerIds[0];
          if (actorPlayerId != null && targetId != null)
            stealTreasure(actorPlayerId, targetId, ctx);
        },
      ),
    },
  };

  function resolveLanding(playerId: number, ctx: Context): void {
    ctx.movement.resolveLanding({
      trackId: program.trackId,
      playerId,
      tiles: program.tiles,
      onLand: ({ position, tile }) => {
        if (!tile) return;
        ctx.events.message('game.pawn.landed', { playerId, tileId: position });
        const rule = program.tileRules[tile.type];
        if (rule.kind === 'draw' && rule.deck)
          resolveCard(playerId, rule.deck, ctx);
        else if (rule.kind === 'gain')
          ctx.resources.add(playerId, program.goldResource, rule.amount ?? 0);
        else if (rule.kind === 'finish') finishOrRetreat(playerId, ctx);
      },
    });
  }

  function resolveCard(
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
        addToCollection(playerId, kind, card, ctx);
        const rule = program.deckRules[kind];
        if (
          rule.resolveEffects &&
          (!rule.protected || !consumeImmunity(playerId, ctx))
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

  function consumeImmunity(playerId: number, ctx: Context): boolean {
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

  function finishOrRetreat(playerId: number, ctx: Context): void {
    const treasures = ctx.inventory.items(
      program.inventories[program.victoryCollection],
      playerId,
    ).length;
    if (
      treasures >= program.requiredTreasures ||
      ctx.resources.get(playerId, program.goldResource) >= program.requiredGold
    ) {
      ctx.match.finish({ winners: [playerId], reason: program.finishReason });
      ctx.events.message(`${program.eventNamespace}.chest.opened`, {
        playerId,
      });
    } else {
      ctx.movement.move(program.trackId, playerId, -program.retreatSpaces);
      ctx.events.message(`${program.eventNamespace}.chest.closed`, {
        playerId,
        retreat: program.retreatSpaces,
      });
    }
  }

  function stealTreasure(
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
}
