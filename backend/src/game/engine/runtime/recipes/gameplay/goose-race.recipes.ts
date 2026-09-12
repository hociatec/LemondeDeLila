import type {
  GooseRaceProgram,
  GooseTile,
} from '../../extensions/goose-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { sequentialPawnSelection } from './pawn-selection.recipes';
import { publicField } from '../../kits/visibility-kit';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;

export function gooseRaceRules(source: GooseRaceProgram) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    ...program.pawnSelection,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo(program.playingPhase);
      const starterId = ctx.round.starter();
      if (starterId != null) {
        ctx.turn.to(starterId);
        ctx.events.message('game.started', { startingPlayerId: starterId });
      }
    },
  });
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      available: ({ ctx }) => ctx.phase.current() === program.playingPhase,
      execute: ({ actor, ctx }) => {
        const value = ctx.dice.roll(program.diceId).total;
        ctx.events.message('game.dice.rolled', {
          playerId: actor.id,
          diceId: program.diceId,
          value,
        });
        if (ctx.status.has(actor.id, program.wellStatus)) {
          if (value !== 1) {
            ctx.events.message('goose.well.blocked', { playerId: actor.id });
            ctx.turn.end();
            return;
          }
          ctx.status.remove(actor.id, program.wellStatus);
        }
        land(
          program,
          actor.id,
          ctx.movement.preview(program.trackId, actor.id, value),
          value,
          0,
          ctx,
        );
        if (ctx.match.lifecycle() !== 'finished') ctx.turn.end();
      },
    }),
    setup: pawns.setup(() => ({}), { order: 'shuffled', startRound: true }),
    choices: {
      [program.pawnSelection.choiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
    },
    playerValuesVisibility: { statuses: publicField() },
  };
}
function land(
  program: GooseRaceProgram,
  playerId: number,
  position: number,
  rollValue: number,
  depth: number,
  ctx: Context,
): void {
  if (depth > program.maxDepth)
    throw new GameRuleViolationError('GOOSE_LANDING_DEPTH_EXCEEDED');
  const actual = ctx.movement.moveTo(program.trackId, playerId, position);
  const tile = program.tiles[actual];
  if (!tile)
    throw new GameRuleViolationError('GOOSE_TILE_MISSING', {
      position: actual,
    });
  announceLanding(playerId, actual, tile, ctx);
  if (tile.type === 'finish')
    ctx.match.finish({ winners: [playerId], reason: program.finishReason });
  else if (tile.type === 'bridge')
    land(
      program,
      playerId,
      program.bridgeDestination,
      rollValue,
      depth + 1,
      ctx,
    );
  else if (tile.type === 'death' || tile.type === 'labyrinth')
    land(program, playerId, tile.backTo ?? 1, rollValue, depth + 1, ctx);
  else if (tile.type === 'inn' || tile.type === 'prison')
    ctx.turn.skip(playerId, tile.turnsToSkip ?? 1);
  else if (tile.type === 'magic-die') {
    const magic = ctx.dice.roll(program.diceId).total;
    const delta = magic <= 3 ? magic : -magic;
    land(
      program,
      playerId,
      ctx.movement.preview(program.trackId, playerId, delta),
      magic,
      depth + 1,
      ctx,
    );
  } else if (tile.type === 'well')
    ctx.status.add(playerId, program.wellStatus, { scope: 'match' });
  else if (tile.type === 'goose')
    land(
      program,
      playerId,
      ctx.movement.preview(program.trackId, playerId, rollValue),
      rollValue,
      depth + 1,
      ctx,
    );
}

function announceLanding(
  playerId: number,
  position: number,
  tile: GooseTile,
  ctx: Context,
): void {
  ctx.events.message('game.pawn.landed', {
    playerId,
    tileId: tile.id,
    position,
  });
  if (tile.description)
    ctx.events.message('goose.tile.effect', {
      playerId,
      tileId: tile.id,
      tileType: tile.type,
    });
}
