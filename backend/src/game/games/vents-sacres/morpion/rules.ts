import {
  rejectRule,
  defineAction,
  defineEvent,
  gameInput,
  playerId as toPlayerId,
  scanGridWinner,
  type GameActionDefinition,
  type GameContext,
} from '../../../engine/sdk/public-api';
import type { NoGameState as MorpionState } from '../../../engine/sdk/public-api';

type PlayInput = { x: number; y: number };
const MARK_PLACED = defineEvent({
  type: 'morpion.mark.placed',
  data: gameInput.object({
    x: gameInput.number({ integer: true, min: 0, max: 2 }),
    y: gameInput.number({ integer: true, min: 0, max: 2 }),
    playerId: gameInput.playerId(),
  }),
});

export const play = defineAction<MorpionState, PlayInput>({
  input: gameInput.object({
    x: gameInput.number({ integer: true, min: 0, max: 2 }),
    y: gameInput.number({ integer: true, min: 0, max: 2 }),
  }),
  validate: ({ input, ctx }) => ctx.grid.get<number>('morpion', input) == null,
  enumerate: ({ ctx }) => ctx.grid.emptyCells('morpion'),
  execute: ({ state: _state, actor, input, ctx }) => {
    if (ctx.grid.get<number>('morpion', input) != null) {
      rejectRule('Cette case est occupée');
    }
    ctx.grid.set('morpion', input, actor.id);
    ctx.events.message('morpion.mark.placed', {
      playerId: actor.id,
      x: input.x,
      y: input.y,
    });
    MARK_PLACED.emit(ctx, { ...input, playerId: toPlayerId(actor.id) });
    ctx.turn.end();
  },
  documentation: 'Place le pion du joueur sur une case vide de la grille 3×3.',
});

export const MORPION_ACTIONS = { morpion_play: play } satisfies Record<
  string,
  GameActionDefinition<MorpionState, PlayInput>
>;

export function chooseBotMove(
  ctx: GameContext<MorpionState>,
  botPlayerId: number,
  opponentId: number | null,
): PlayInput | null {
  const board = boardState(ctx);
  return (
    winningMove(board, botPlayerId) ??
    (opponentId == null ? null : winningMove(board, opponentId)) ??
    preferredMove(board)
  );
}

export function boardState(ctx: GameContext<MorpionState>): number[] {
  return Array.from(
    { length: 9 },
    (_, index) =>
      ctx.grid.get<number>('morpion', {
        x: index % 3,
        y: Math.floor(index / 3),
      }) ?? 0,
  );
}

function winningMove(
  board: readonly number[],
  playerId: number,
): PlayInput | null {
  for (const cell of emptyCells(board)) {
    const candidate = [...board];
    candidate[cell.y * 3 + cell.x] = playerId;
    if (scanGridWinner(candidate, 3, 3, 3) === playerId) return cell;
  }
  return null;
}

function preferredMove(board: readonly number[]): PlayInput | null {
  const preferred = [
    { x: 1, y: 1 },
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
  ];
  return (
    preferred.find((cell) => board[cell.y * 3 + cell.x] === 0) ??
    emptyCells(board)[0] ??
    null
  );
}

function emptyCells(board: readonly number[]): PlayInput[] {
  return board.flatMap((owner, index) =>
    owner === 0 ? [{ x: index % 3, y: Math.floor(index / 3) }] : [],
  );
}
