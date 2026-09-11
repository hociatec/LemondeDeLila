import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { defineChoice, gameInput, when } from '../../../engine/sdk/public-api';
import { blockedPosition } from './blocked-player';
import {
  CONTES_PHASES,
  resolveCard,
  resolveLaughter,
  resolveOption,
  resolvePawn,
  resolveReroll,
  resolveToken,
  skipBlockedContesPlayer,
  unblockPassedPlayers,
} from './rules';
import type { ContesState } from './types';
export const GAME_RULES = {
  choices: {
    'contes.pawn': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
    'contes.reroll': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveReroll(state, actor.id, value, ctx),
    }),
    'contes.option': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveOption(state, actor.id, value, ctx),
    }),
    'contes.number': defineChoice<ContesState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveLaughter(state, actor.id, value, ctx),
    }),
    'contes.card': defineChoice<ContesState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveCard(state, actor.id, value, ctx),
    }),
    'contes.token': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveToken(state, actor.id, value, ctx),
    }),
  },
  automatic: [
    when(
      'unblock-passed-player',
      ({ state: _state, ctx }) => {
        const player = ctx.players.current();
        const blocked = player ? blockedPosition(ctx, player.id) : null;
        return (
          CONTES_PHASES.is(ctx, 'playing') &&
          player != null &&
          blocked != null &&
          ctx.players
            .all()
            .some(
              (other) =>
                other.id !== player.id &&
                ctx.movement.position('story-road', other.id) >= blocked,
            )
        );
      },
      ({ state, ctx }) => unblockPassedPlayers(state, ctx),
    ),
    when(
      'skip-sleeping-or-blocked-player',
      ({ state: _state, ctx }) => {
        const player = ctx.players.current();
        return (
          CONTES_PHASES.is(ctx, 'playing') &&
          player != null &&
          blockedPosition(ctx, player.id) != null
        );
      },
      ({ state, ctx }) => skipBlockedContesPlayer(state, ctx),
    ),
  ],
} satisfies GameRuleBindings<ContesState>;
