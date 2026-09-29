import { defineAction, defineChoice } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type { GameContext } from '../definitions/game-author-context';
import { sequentialPawnSelection } from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';

type State = Record<string, never>;
type Context = GameContext<State>;

export type GooseRaceTile = {
  id: string;
  label: string;
  description?: string;
  type: string;
  turnsToSkip?: number;
  backTo?: number;
};

export type GooseRaceOptions = {
  rollRecipe: string;
  trackId: string;
  diceId: string;
  playingPhase: string;
  wellStatus: string;
  finishReason: string;
  maxDepth: number;
  bridgeDestination: number;
  tiles: readonly GooseRaceTile[];
  pawnSelection: { setId: string; choiceId: string };
  escapeRolls: readonly number[];
  forwardRollMaximum: number;
  defaultReturn: number;
  defaultSkip: number;
  tileRules: Readonly<
    Record<
      string,
      | 'none'
      | 'finish'
      | 'move-to'
      | 'return'
      | 'skip'
      | 'roll-directed'
      | 'block'
      | 'repeat-roll'
    >
  >;
};

export function gooseRace(source: GooseRaceOptions) {
  const options = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    ...options.pawnSelection,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo(options.playingPhase);
      const starterId = ctx.round.starter();
      if (starterId != null) {
        ctx.turn.to(starterId);
        ctx.events.message('game.started', { startingPlayerId: starterId });
      }
    },
  });
  return definePattern({
    id: `goose-race:${options.trackId}`,
    mechanics: ['race', 'pawns', 'recursive-landing'],
    actions: {
      [options.rollRecipe]: defineAction<State, Record<string, never>>({
        input: gameInput.object({}),
        available: ({ ctx }) => ctx.phase.current() === options.playingPhase,
        execute: ({ actor, ctx }) => {
          const value = ctx.dice.roll(options.diceId).total;
          ctx.events.message('game.dice.rolled', {
            playerId: actor.id,
            diceId: options.diceId,
            value,
          });
          if (ctx.status.has(actor.id, options.wellStatus)) {
            if (!options.escapeRolls.includes(value)) {
              ctx.events.message('goose.well.blocked', { playerId: actor.id });
              ctx.turn.end();
              return;
            }
            ctx.status.remove(actor.id, options.wellStatus);
          }
          land(
            options,
            actor.id,
            ctx.movement.preview(options.trackId, actor.id, value),
            value,
            0,
            ctx,
          );
          if (ctx.match.lifecycle() !== 'finished') ctx.turn.end();
        },
      }),
    },
    setup: pawns.setup(() => ({}), { order: 'shuffled', startRound: true }),
    choices: {
      [options.pawnSelection.choiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
    },
  });
}

function land(
  options: GooseRaceOptions,
  playerId: number,
  position: number,
  rollValue: number,
  depth: number,
  ctx: Context,
): void {
  if (depth > options.maxDepth)
    throw new GameRuleViolationError('GOOSE_LANDING_DEPTH_EXCEEDED');
  const actual = ctx.movement.moveTo(options.trackId, playerId, position);
  const tile = options.tiles[actual];
  if (!tile)
    throw new GameRuleViolationError('GOOSE_TILE_MISSING', {
      position: actual,
    });
  announceLanding(playerId, actual, tile, ctx);
  const operation = options.tileRules[tile.type];
  if (operation === 'finish')
    ctx.match.finish({ winners: [playerId], reason: options.finishReason });
  else if (operation === 'move-to')
    land(
      options,
      playerId,
      options.bridgeDestination,
      rollValue,
      depth + 1,
      ctx,
    );
  else if (operation === 'return')
    land(
      options,
      playerId,
      tile.backTo ?? options.defaultReturn,
      rollValue,
      depth + 1,
      ctx,
    );
  else if (operation === 'skip')
    ctx.turn.skip(playerId, tile.turnsToSkip ?? options.defaultSkip);
  else if (operation === 'roll-directed') {
    const magic = ctx.dice.roll(options.diceId).total;
    const delta = magic <= options.forwardRollMaximum ? magic : -magic;
    land(
      options,
      playerId,
      ctx.movement.preview(options.trackId, playerId, delta),
      magic,
      depth + 1,
      ctx,
    );
  } else if (operation === 'block')
    ctx.status.add(playerId, options.wellStatus, { scope: 'match' });
  else if (operation === 'repeat-roll')
    land(
      options,
      playerId,
      ctx.movement.preview(options.trackId, playerId, rollValue),
      rollValue,
      depth + 1,
      ctx,
    );
}

function announceLanding(
  playerId: number,
  position: number,
  tile: GooseRaceTile,
  ctx: Context,
): void {
  ctx.events.message('game.pawn.landed', {
    playerId,
    tileId: tile.id,
    position,
  });
  if (tile.description)
    ctx.events.message(
      'game.board.tile-description',
      {
        playerId,
        tileId: tile.id,
        tileType: tile.type,
        tileLabel: tile.label,
        tileDescription: tile.description,
      },
      { default: `${tile.label}. ${tile.description}` },
    );
}
