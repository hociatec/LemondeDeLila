import type { EventRaceProgram } from '../../effect-packs/race-event-cards/program';
import type { GameContext } from '../../definitions/game-author-context';
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import { defineChoice } from '../../actions/action-builders';
import { defineEffect } from '../../effects/effects-core';
import { gameInput } from '../../actions/game-input-schema';
import { drawEvent, raceTurn } from './card-dice.recipes';
import { sequentialPawnSelection } from './pawn-selection.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = { id: string | number; effects: readonly GameEffectInstruction[] };

export function eventRaceRules(source: EventRaceProgram) {
  const program = structuredClone(source);
  const land = (playerId: number, ctx: Context) =>
    resolveLanding(program, playerId, ctx);
  const pawns = sequentialPawnSelection<State>({
    ...program.pawnSelection,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo(program.playingPhase);
      const first = ctx.players.all()[0];
      if (first) ctx.turn.to(first.id);
    },
  });
  return {
    roll: raceTurn<State>({
      trackId: program.trackId,
      diceId: program.diceId,
      available: ({ ctx }) => ctx.phase.current() === program.playingPhase,
      resolveLanding: ({ playerId, ctx }) => land(playerId, ctx),
    }),
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnSelection.choiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
    },
    effects: {
      [program.landingEffectId]: defineEffect<State, Record<string, never>>({
        input: gameInput.object({}),
        apply: ({ actorPlayerId, ctx }) => {
          if (actorPlayerId != null) land(actorPlayerId, ctx);
        },
      }),
    },
  };
}
function resolveLanding(
  program: EventRaceProgram,
  playerId: number,
  ctx: Context,
): void {
  ctx.movement.resolveLanding({
    trackId: program.trackId,
    playerId,
    tiles: program.tiles,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: position });
      if (!tile.deckId) return;
      const card = drawEvent<State, Card>(ctx, {
        deckId: tile.deckId,
        playerId,
        recycle: true,
        discard: true,
      });
      if (!card) return;
      ctx.events.message('game.card.drawn', {
        playerId,
        deckId: tile.deckId,
        cardId: card.id,
      });
      ctx.effects.schedule(...card.effects);
    },
  });
}
