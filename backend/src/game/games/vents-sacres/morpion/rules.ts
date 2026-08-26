import {
  defineAction,
  gameInput,
  type GameActionDefinition,
} from '../../../core/application/public-api';
import { MORPION_PAWNS } from './content';
import type { MorpionState } from './state';

type PlayInput = { x: number; y: number };

export const play = defineAction<MorpionState, PlayInput>({
  input: gameInput.object({
    x: gameInput.number({ integer: true, min: 0, max: 2 }),
    y: gameInput.number({ integer: true, min: 0, max: 2 }),
  }),
  availableInputs: ({ state }) => emptyCells(state.board),
  execute: ({ state, actor, input, ctx }) => {
    const index = input.y * state.size + input.x;
    if (state.board[index] !== 0) throw new Error('Cette case est occupée');
    state.board[index] = actor.id;
    state.winnerId = detectWinner(state.board);
    state.draw = state.winnerId == null && state.board.every(Boolean);
    const pawn = pawnFor(state, actor.id);
    ctx.history.add(
      `${actor.username} place ${pawn?.label ?? pawn?.glyph ?? 'son pion'} en ${cellReference(input)}.`,
    );
    ctx.events.emit('morpion.mark.placed', { ...input, playerId: actor.id });
    if (!state.winnerId && !state.draw) ctx.turn.end();
  },
  documentation: 'Place le pion du joueur sur une case vide de la grille 3×3.',
});

export const MORPION_ACTIONS = { morpion_play: play } satisfies Record<
  string,
  GameActionDefinition<MorpionState, PlayInput>
>;

export function detectWinner(board: readonly number[]): number | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [first, second, third] of lines) {
    const owner = board[first] ?? 0;
    if (owner !== 0 && owner === board[second] && owner === board[third]) {
      return owner;
    }
  }
  return null;
}

export function chooseBotMove(
  state: MorpionState,
  botPlayerId: number,
  opponentId: number | null,
): PlayInput | null {
  return (
    winningMove(state.board, botPlayerId) ??
    (opponentId == null ? null : winningMove(state.board, opponentId)) ??
    preferredMove(state.board)
  );
}

function winningMove(
  board: readonly number[],
  playerId: number,
): PlayInput | null {
  for (const cell of emptyCells(board)) {
    const candidate = [...board];
    candidate[cell.y * 3 + cell.x] = playerId;
    if (detectWinner(candidate) === playerId) return cell;
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

function pawnFor(state: MorpionState, playerId: number) {
  const pawnId = state.glyphByPlayerId[String(playerId)];
  return MORPION_PAWNS.find((pawn) => pawn.id === pawnId) ?? null;
}

function cellReference(input: PlayInput): string {
  return `${String.fromCharCode(65 + input.x)}${3 - input.y}`;
}
