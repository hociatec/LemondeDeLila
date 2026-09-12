import type { CollectionRaceProgram } from '../../extensions/collection-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEvent } from '../../events/game-event-definition';
import { gameInput } from '../../actions/game-input-schema';
import { drawEvent, raceTurn } from './card-dice.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = { id: string | number };

export function collectionRaceRules(source: CollectionRaceProgram) {
  const program = structuredClone(source);
  const collected = defineEvent({
    type: program.collectedEvent,
    data: gameInput.object({
      playerId: gameInput.playerId(),
      zoneId: gameInput.number({ integer: true, min: 1 }),
      cardId: gameInput.number({ integer: true, min: 1 }),
    }),
  });
  return {
    roll: raceTurn<State>({
      trackId: program.trackId,
      diceId: program.diceId,
      resolveLanding: ({ playerId, position, ctx }) => {
        const tile = program.tiles[position];
        if (!tile) return;
        ctx.events.message('game.pawn.landed', { playerId, tileId: tile.n });
        if (tile.type === 'finish') {
          finish(program, ctx);
          return;
        }
        const zone = program.zones.find(
          (candidate) =>
            tile.n >= candidate.minimumTile && tile.n <= candidate.maximumTile,
        );
        if (!zone) return;
        const card = drawEvent<State, Card>(ctx, {
          deckId: zone.deckId,
          playerId,
          recycle: true,
          discard: true,
        });
        if (!card) {
          ctx.events.message(`${program.eventNamespace}.zone.empty`, {
            zoneId: zone.id,
          });
          return;
        }
        ctx.score.add(playerId, 1);
        ctx.resources.add(playerId, zone.resourceId, 1);
        ctx.events.message(program.collectedEvent, {
          playerId,
          zoneId: zone.id,
          cardId: card.id,
        });
        collected.emit(ctx, {
          playerId: gameInput.playerId().parse(playerId),
          zoneId: zone.id,
          cardId: gameInput.number({ integer: true, min: 1 }).parse(card.id),
        });
      },
    }),
    events: [collected],
  };
}
function finish(program: CollectionRaceProgram, ctx: Context): void {
  const ranked = ctx.ranking.rank(
    ctx.players.all().map((player) => player.id),
    { value: (id) => ctx.score.get(id), direction: 'desc' },
    ...program.zones.map((zone) => ({
      value: (id: number) => ctx.resources.get(id, zone.resourceId),
      direction: 'desc' as const,
    })),
  );
  const winnerId = ranked[0]?.playerId;
  if (winnerId == null) return;
  ctx.events.message(`${program.eventNamespace}.collection.won`, {
    playerId: winnerId,
    total: ctx.score.get(winnerId),
  });
  ctx.match.finish({ winners: [winnerId], reason: program.finishReason });
}
