import { defineAction, defineChoice } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import { defineEffect } from '../effects/effects-core';
import {
  drawAndResolve,
  rollDice,
  sequentialPawnSelection,
} from '../recipes/gameplay-recipes';
import { definePattern } from './gameplay-pattern-core';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = {
  id: string | number;
  effects: readonly GameEffectInstruction[];
};
type PendingDraw = { playerId: number; deckId: string };

export type EventCardRaceOptions = {
  rollRecipe: string;
  drawRecipe: string;
  trackId: string;
  diceId: string;
  playingPhase: string;
  landingEffectId: string;
  pendingDrawFlag: string;
  tiles: readonly { label: string; description?: string; deckId?: string }[];
  pawnSelection: { setId: string; choiceId: string };
};

const drawSchema = gameInput.object({
  playerId: gameInput.playerId(),
  deckId: gameInput.string({ min: 1 }),
});

export function eventCardRace(source: EventCardRaceOptions) {
  const options = structuredClone(source);
  const land = (playerId: number, ctx: Context) =>
    resolveLanding(options, playerId, ctx);
  const finishTurn = (ctx: Context) => {
    if (
      ctx.match.lifecycle() !== 'finished' &&
      ctx.choice.current() == null &&
      !ctx.effects.isResolving() &&
      ctx.turn.flags.get(options.pendingDrawFlag) == null
    )
      ctx.turn.complete();
  };
  const pawns = sequentialPawnSelection<State>({
    ...options.pawnSelection,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo(options.playingPhase);
      const first = ctx.players.all()[0];
      if (first) ctx.turn.to(first.id);
    },
  });
  return definePattern({
    id: `event-card-race:${options.trackId}`,
    mechanics: ['race', 'cards', 'pawns', 'effect-pipeline'],
    actions: {
      [options.rollRecipe]: rollDice<State>({
        diceId: options.diceId,
        available: ({ ctx }) =>
          ctx.phase.current() === options.playingPhase &&
          ctx.turn.flags.get(options.pendingDrawFlag) == null,
        execute: ({ playerId, total, ctx }) => {
          ctx.movement.moveAndResolve({
            trackId: options.trackId,
            playerId,
            distance: total,
            tiles: options.tiles,
            blocked: () => ctx.match.lifecycle() === 'finished',
            onLand: () => land(playerId, ctx),
          });
          finishTurn(ctx);
        },
        documentation: 'Lance le dé et résout la case.',
      }),
      [options.drawRecipe]: defineAction<State, Record<string, never>>({
        ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
        input: gameInput.object({}),
        available: ({ actor, ctx }) =>
          ctx.phase.current() === options.playingPhase &&
          ctx.players.current()?.id === actor.id &&
          readFlag(ctx, options.pendingDrawFlag)?.playerId === actor.id,
        execute: ({ actor, ctx }) => {
          const pending = readFlag(ctx, options.pendingDrawFlag);
          if (!pending || pending.playerId !== actor.id)
            return ctx.reject('EVENT_CARD_DRAW_NOT_PENDING');
          ctx.turn.flags.consume(options.pendingDrawFlag);
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
    },
    setup: pawns.setup(() => ({})),
    choices: {
      [options.pawnSelection.choiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
    },
    effects: {
      [options.landingEffectId]: defineEffect<State, Record<string, never>>({
        input: gameInput.object({}),
        apply: ({ actorPlayerId, ctx }) => {
          if (actorPlayerId != null) land(actorPlayerId, ctx);
        },
      }),
    },
  });
}

function readFlag(ctx: Context, pendingDrawFlag: string): PendingDraw | null {
  const value = ctx.turn.flags.get(pendingDrawFlag);
  return value == null
    ? null
    : drawSchema.parse(value, `turn.flags.${pendingDrawFlag}`);
}

function resolveLanding(
  options: EventCardRaceOptions,
  playerId: number,
  ctx: Context,
): void {
  ctx.movement.resolveLanding({
    trackId: options.trackId,
    playerId,
    tiles: options.tiles,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ tile }) => {
      if (!tile?.deckId) return;
      ctx.turn.flags.set(options.pendingDrawFlag, {
        playerId,
        deckId: tile.deckId,
      } satisfies PendingDraw);
      ctx.events.message('game.card.draw-required', { playerId });
    },
  });
}
