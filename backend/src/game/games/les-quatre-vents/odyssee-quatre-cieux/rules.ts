import { defineAction, gameInput } from '../../../core/application/public-api';
import { ODYSSEE_CONTENT } from './content';
import type { OdysseeState } from './state';

export type OdysseeMove = {
  pawnIndex: number;
  targetProgress: number;
  roll: number;
};

export const roll = defineAction<OdysseeState, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    ctx.history.add(`${actor.username} lance le dé : « ${value} ».`);
    const moves = computeMoves(state, actor.id, value);
    if (moves.length === 0) {
      ctx.history.add(`${actor.username} ne peut jouer aucun pion.`);
      endMove(ctx, value);
      return;
    }
    if (moves.length === 1) {
      applyMove(state, actor.id, moves[0], ctx.history.add);
      endMove(ctx, value);
      return;
    }
    ctx.choice.one({
      id: 'odyssee.move',
      player: actor.id,
      options: moves,
      label: (move) => `${pawnName(move.pawnIndex)} → ${move.targetProgress}`,
    });
  },
  documentation: 'Lance le dé et déplace automatiquement ou demande un pion.',
});

export const ODYSSEE_ACTIONS = { roll };

export function computeMoves(
  state: OdysseeState,
  playerId: number,
  rollValue: number,
): OdysseeMove[] {
  const arrival = state.trackLength + state.homeLength - 1;
  return (state.pawnsByPlayer[playerId] ?? []).flatMap((pawn) => {
    if (pawn.progress < 0 && rollValue !== 6) return [];
    const targetProgress = pawn.progress < 0 ? 0 : pawn.progress + rollValue;
    return targetProgress <= arrival
      ? [{ pawnIndex: pawn.pawnIndex, targetProgress, roll: rollValue }]
      : [];
  });
}

export function applyMove(
  state: OdysseeState,
  playerId: number,
  move: OdysseeMove,
  log: (message: string) => void,
): void {
  const pawn = state.pawnsByPlayer[playerId]?.find(
    (candidate) => candidate.pawnIndex === move.pawnIndex,
  );
  if (!pawn) throw new Error('Pion inconnu');
  pawn.progress = move.targetProgress;
  log(`Le joueur avance ${pawnName(move.pawnIndex)}.`);
  const arrival = state.trackLength + state.homeLength - 1;
  if (
    (state.pawnsByPlayer[playerId] ?? []).every(
      (candidate) => candidate.progress >= arrival,
    )
  ) {
    state.winnerId = playerId;
  }
}

export function endMove(
  ctx: { turn: { extra(): void; end(): void } },
  rollValue: number,
): void {
  if (rollValue === 6) ctx.turn.extra();
  ctx.turn.end();
}

function pawnName(index: number): string {
  return ODYSSEE_CONTENT.pawnNames[index] ?? `Pion ${index + 1}`;
}
