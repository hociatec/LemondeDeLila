import { drawEvent } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type { DirectionalHazardRaceProgram } from './program';
type State = Record<string, never>;
type Context = GameContext<State>;
type Card = DirectionalHazardRaceProgram['cards'][number];

export function resolveTile(
  program: DirectionalHazardRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  ctx.movement.resolveLanding({
    trackId: program.trackId,
    playerId,
    tiles: program.tiles,
    depth,
    maxDepth: program.maxDepth,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: position });
      if (
        program.victoryMode !== 'external' &&
        position >= program.tiles.length - 1
      ) {
        ctx.match.finish({ winners: [playerId], reason: program.finishReason });
        return;
      }
      if (tile.isNeutral) return;
      const card = drawEvent<State, Card>(ctx, {
        deckId: program.deckId,
        playerId,
        recycle: true,
        discard: true,
      });
      if (!card) return;
      ctx.events.message('game.card.drawn', {
        playerId,
        deckId: program.deckId,
        cardId: card.id,
      });
      ctx.effects.schedule(...card.effects);
    },
  });
}
