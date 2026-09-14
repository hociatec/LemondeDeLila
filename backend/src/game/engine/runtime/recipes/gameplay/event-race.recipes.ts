import type { EventRaceProgram } from '../../effect-packs/race-event-cards/program';
import type { GameContext } from '../../definitions/game-author-context';
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { defineEffect } from '../../effects/effects-core';
import { gameInput } from '../../actions/game-input-schema';
import { drawAndResolve, rollDice } from './card-dice.recipes';
import { sequentialPawnSelection } from './pawn-selection.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = {
  id: string | number;
  effects: readonly GameEffectInstruction[];
};
type PendingDraw = { playerId: number; deckId: string };

const pendingDrawFlag = 'race-event-cards.pending-draw';

export function eventRaceRules(source: EventRaceProgram) {
  const program = structuredClone(source);
  const land = (playerId: number, ctx: Context) =>
    resolveLanding(program, playerId, ctx);
  const finishTurn = (ctx: Context) => {
    if (
      ctx.match.lifecycle() !== 'finished' &&
      ctx.choice.current() == null &&
      !ctx.effects.isResolving() &&
      ctx.turn.flags.get(pendingDrawFlag) == null
    )
      ctx.turn.complete();
  };
  const pawns = sequentialPawnSelection<State>({
    ...program.pawnSelection,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo(program.playingPhase);
      const first = ctx.players.all()[0];
      if (first) ctx.turn.to(first.id);
    },
  });
  return {
    roll: rollDice<State>({
      diceId: program.diceId,
      available: ({ ctx }) =>
        ctx.phase.current() === program.playingPhase &&
        ctx.turn.flags.get(pendingDrawFlag) == null,
      execute: ({ playerId, total, ctx }) => {
        ctx.movement.moveAndResolve({
          trackId: program.trackId,
          playerId,
          distance: total,
          tiles: program.tiles,
          blocked: () => ctx.match.lifecycle() === 'finished',
          onLand: () => land(playerId, ctx),
        });
        finishTurn(ctx);
      },
      documentation: 'Lance le dé et résout la case de jungle.',
    }),
    draw: defineAction<State, Record<string, never>>({
      ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
      input: gameInput.object({}),
      available: ({ actor, ctx }) =>
        ctx.phase.current() === program.playingPhase &&
        ctx.players.current()?.id === actor.id &&
        ctx.turn.flags.get<PendingDraw>(pendingDrawFlag)?.playerId === actor.id,
      execute: ({ actor, ctx }) => {
        const pending = ctx.turn.flags.get<PendingDraw>(pendingDrawFlag);
        if (!pending || pending.playerId !== actor.id)
          return ctx.reject('EVENT_CARD_DRAW_NOT_PENDING');
        ctx.turn.flags.consume(pendingDrawFlag);
        drawAndResolve<State, Card>(ctx, {
          deckId: pending.deckId,
          playerId: actor.id,
          automatic: false,
          recycle: true,
          discard: true,
          resolve: (card) => ctx.effects.schedule(...card.effects),
        });
        finishTurn(ctx);
      },
      documentation: 'Pioche et résout la carte demandée par la case.',
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
    onLand: ({ tile }) => {
      if (!tile) return;
      if (!tile.deckId) return;
      ctx.turn.flags.set(pendingDrawFlag, {
        playerId,
        deckId: tile.deckId,
      } satisfies PendingDraw);
      ctx.events.message('game.card.draw-required', { playerId });
    },
  });
}
