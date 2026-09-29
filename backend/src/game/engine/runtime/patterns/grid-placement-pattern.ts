import { defineAction, defineChoice } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { PlayerState } from '../../../core/application/models/game-state.model';
import type { ChoiceResolverShape } from '../contracts/author-rule-contracts';
import type { GameContext } from '../definitions/game-author-context';
import { defineEvent } from '../events/game-event-definition';
import { scanGridWinner, type GridPosition } from '../kits/grid-kit';
import { sequentialPawnSelection } from '../recipes/gameplay-recipes';
import { definePattern } from './gameplay-pattern-core';
import { gridGame } from './gameplay-pattern-round-economy';

export type GridPlacementOptions = {
  playRecipe: string;
  playAction: string;
  boardId: string;
  width: number;
  height: number;
  winLength: number;
  drawWhenFull: boolean;
  winnerReason: string;
  drawReason: string;
  markEvent: string;
  preferredCells: readonly GridPosition[];
  pawnSelection?: {
    setId: string;
    choiceId: string;
    order: 'players' | 'shuffled';
    automatic?: boolean;
  };
};

type State = Record<string, never>;
type Context = GameContext<State>;

/** A bounded line-building board whose rules are entirely configured by JSON. */
export function gridPlacement(source: GridPlacementOptions) {
  const options = structuredClone(source);
  const board = gridGame<State>({
    boardId: options.boardId,
    width: options.width,
    height: options.height,
    winLength: options.winLength,
    drawWhenFull: options.drawWhenFull,
    winnerReason: options.winnerReason,
    drawReason: options.drawReason,
  });
  const placed = defineEvent({
    type: options.markEvent,
    data: gameInput.object({
      x: gameInput.number({ integer: true, min: 0, max: options.width - 1 }),
      y: gameInput.number({ integer: true, min: 0, max: options.height - 1 }),
      playerId: gameInput.playerId(),
    }),
  });
  const selection = bindSelection(options);
  return definePattern({
    ...board,
    id: `grid-placement:${options.boardId}`,
    mechanics: [...board.mechanics, 'placement', 'pawn-selection'],
    actions: {
      [options.playRecipe]: defineAction<State, GridPosition>({
        input: gameInput.object({
          x: gameInput.number({
            integer: true,
            min: 0,
            max: options.width - 1,
          }),
          y: gameInput.number({
            integer: true,
            min: 0,
            max: options.height - 1,
          }),
        }),
        validate: ({ input, ctx }) =>
          ctx.grid.get(options.boardId, input) == null,
        enumerate: ({ ctx }) => ctx.grid.emptyCells(options.boardId),
        execute: ({ actor, input, ctx }) => {
          ctx.grid.set(options.boardId, input, actor.id);
          ctx.events.message(options.markEvent, {
            playerId: actor.id,
            ...input,
          });
          placed.emit(ctx, {
            ...input,
            playerId: gameInput.playerId().parse(actor.id),
          });
          ctx.turn.end();
        },
      }),
    },
    choices: selection.choices,
    setup: selection.setup,
    events: [placed],
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        if (!availableActions.includes(options.playAction)) return null;
        const payload = choosePlacement(options, ctx, actor.id);
        return payload ? { type: options.playAction, payload } : null;
      },
    },
  });
}

function bindSelection(options: GridPlacementOptions): {
  choices: Record<string, ChoiceResolverShape<State>>;
  setup?: (input: { players: PlayerState[]; ctx: Context }) => object;
} {
  const choices: Record<string, ChoiceResolverShape<State>> = {};
  const config = options.pawnSelection;
  if (!config) return { choices };
  const selection = sequentialPawnSelection<State>({
    setId: config.setId,
    choiceId: config.choiceId,
    automatic: config.automatic,
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
  options: GridPlacementOptions,
  ctx: Context,
  playerId: number,
): GridPosition | null {
  const board = Array.from(
    { length: options.width * options.height },
    (_, index) =>
      ctx.grid.get<number>(options.boardId, {
        x: index % options.width,
        y: Math.floor(index / options.width),
      }) ?? 0,
  );
  const empty = ctx.grid.emptyCells(options.boardId);
  const players = [
    playerId,
    ...ctx.players
      .active()
      .filter((player) => player.id !== playerId)
      .map((player) => player.id),
  ];
  for (const id of players) {
    for (const cell of empty) {
      const candidate = [...board];
      candidate[cell.y * options.width + cell.x] = id;
      if (
        scanGridWinner(
          candidate,
          options.width,
          options.height,
          options.winLength,
        ) === id
      )
        return cell;
    }
  }
  return (
    options.preferredCells.find(
      (cell) => board[cell.y * options.width + cell.x] === 0,
    ) ??
    empty[0] ??
    null
  );
}
