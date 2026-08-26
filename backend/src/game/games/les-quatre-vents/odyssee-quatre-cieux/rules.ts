import {
  rejectRule,
  defineAction,
  gameInput,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import { ODYSSEE_CONTENT } from './content';
import type { OdysseeState } from './state';

type RuleContext = GameContext<OdysseeState>;

export type OdysseeMove = {
  pawnIndex: number;
  targetProgress: number;
  roll: number;
};

export const roll = defineAction<OdysseeState, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      total: value,
    });
    const moves = computeMoves(actor.id, value, ctx);
    if (moves.length === 0) {
      ctx.events.message('game.pawn.no-legal-move', { playerId: actor.id });
      endMove(ctx, value);
      return;
    }
    if (moves.length === 1) {
      applyMove(state, actor.id, moves[0], ctx);
      if (ctx.match.lifecycle() !== 'finished') endMove(ctx, value);
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
  playerId: number,
  rollValue: number,
  ctx: RuleContext,
): OdysseeMove[] {
  return ctx.pawns
    .legalMoves('odyssee', playerId, rollValue, {
      enterOn: 6,
      entryPosition: 0,
      exactFinish: true,
    })
    .map((move) => ({
      pawnIndex: Number(move.pawnId.split(':')[1]),
      targetProgress: move.to,
      roll: rollValue,
    }));
}

export function applyMove(
  _state: OdysseeState,
  playerId: number,
  move: OdysseeMove,
  ctx: RuleContext,
): void {
  const pawn = pawnsFor(playerId, ctx).find(
    (candidate) => candidate.pawnIndex === move.pawnIndex,
  );
  if (!pawn) rejectRule('Pion inconnu');
  ctx.pawns.applyMove('odyssee', {
    pawnId: pawn.pawnId,
    from: pawn.progress,
    to: move.targetProgress,
    distance: move.targetProgress - pawn.progress,
  });
  ctx.events.message('game.pawn.moved', {
    playerId,
    pawnId: pawn.pawnId,
    target: move.targetProgress,
  });
  const arrival = ODYSSEE_CONTENT.trackLength + ODYSSEE_CONTENT.homeLength - 1;
  if (
    pawnsFor(playerId, ctx).every(
      (candidate) => candidate.progress >= arrival,
    )
  ) {
    ctx.match.finish({ winners: [playerId], reason: 'all-pawns-arrived' });
  }
}

export function endMove(
  ctx: Pick<RuleContext, 'turn'>,
  rollValue: number,
): void {
  if (rollValue === 6) ctx.turn.extra();
  ctx.turn.end();
}

function pawnName(index: number): string {
  return ODYSSEE_CONTENT.pawnNames[index] ?? `Pion ${index + 1}`;
}

function pawnsFor(playerId: number, ctx: RuleContext) {
  return ctx.pawns.assigned('odyssee', playerId).map((pawnId) => ({
    pawnId,
    pawnIndex: Number(pawnId.split(':')[1]),
    progress: ctx.pawns.position('odyssee', pawnId),
  }));
}
