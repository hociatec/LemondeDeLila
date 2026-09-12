import type { GridPlacementProgram } from '../../effect-packs/spatial-grid-placement/program';
import type { GameContext } from '../../definitions/game-author-context';
import type { ChoiceResolverShape } from '../../contracts/author-rule-contracts';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { defineEvent } from '../../events/game-event-definition';
import { gridGame } from '../../patterns/gameplay-pattern-round-economy';
import { scanGridWinner, type GridPosition } from '../../kits/grid-kit';
import { sequentialPawnSelection } from './pawn-selection.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

/** Place a mark, detect aligned winners and select legal moves using the Grid kit. */
export function gridPlacementRules(source: GridPlacementProgram) {
  const program = structuredClone(source);
  const coordinates = {
    x: gameInput.number({ integer: true, min: 0, max: program.width - 1 }),
    y: gameInput.number({ integer: true, min: 0, max: program.height - 1 }),
  };
  const placed = defineEvent({
    type: program.markEvent,
    data: gameInput.object({ ...coordinates, playerId: gameInput.playerId() }),
  });
  const play = defineAction<State, GridPosition>({
    input: gameInput.object(coordinates),
    validate: ({ input, ctx }) => ctx.grid.get(program.boardId, input) == null,
    enumerate: ({ ctx }) => ctx.grid.emptyCells(program.boardId),
    execute: ({ actor, input, ctx }) => {
      ctx.grid.set(program.boardId, input, actor.id);
      ctx.events.message(program.markEvent, { playerId: actor.id, ...input });
      placed.emit(ctx, {
        ...input,
        playerId: gameInput.playerId().parse(actor.id),
      });
      ctx.turn.end();
    },
  });
  const selection = bindSelection(program);
  return {
    play,
    ...selection,
    events: [placed],
    pattern: gridGame<State>({
      boardId: program.boardId,
      width: program.width,
      height: program.height,
      winLength: program.winLength,
      drawWhenFull: program.drawWhenFull,
      winnerReason: program.winnerReason,
      drawReason: program.drawReason,
    }),
    choose: (ctx: Context, playerId: number) =>
      choosePlacement(program, ctx, playerId),
  };
}
function bindSelection(program: GridPlacementProgram) {
  const choices: Record<string, ChoiceResolverShape<State>> = {};
  const config = program.pawnSelection;
  if (!config) return { choices, setup: () => ({}) };
  const selection = sequentialPawnSelection<State>({
    setId: config.setId,
    choiceId: config.choiceId,
    complete: ({ ctx }) => {
      const starter = ctx.round.starter();
      if (starter != null) ctx.turn.to(starter);
    },
  });
  choices[config.choiceId] = defineChoice<State, string>({
    input: gameInput.string({ min: 1, max: 128 }),
    resolve: ({ actor, value, ctx }) => selection.resolve(actor.id, value, ctx),
  });
  return {
    choices,
    setup: selection.setup(() => ({}), { order: config.order }),
  };
}

function choosePlacement(
  program: GridPlacementProgram,
  ctx: Context,
  playerId: number,
): GridPosition | null {
  const board = Array.from(
    { length: program.width * program.height },
    (_, index) =>
      ctx.grid.get<number>(program.boardId, {
        x: index % program.width,
        y: Math.floor(index / program.width),
      }) ?? 0,
  );
  const empty = ctx.grid.emptyCells(program.boardId);
  const players = [
    playerId,
    ...ctx.players
      .active()
      .filter((p) => p.id !== playerId)
      .map((p) => p.id),
  ];
  for (const id of players) {
    for (const cell of empty) {
      const candidate = [...board];
      candidate[cell.y * program.width + cell.x] = id;
      if (
        scanGridWinner(
          candidate,
          program.width,
          program.height,
          program.winLength,
        ) === id
      )
        return cell;
    }
  }
  return (
    program.preferredCells.find(
      (cell) => board[cell.y * program.width + cell.x] === 0,
    ) ??
    empty[0] ??
    null
  );
}
