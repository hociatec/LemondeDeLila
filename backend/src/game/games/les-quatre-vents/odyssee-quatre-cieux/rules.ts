import { defineAction, gameInput } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type { PawnMove } from '../../../engine/sdk/public-api';
import { ODYSSEE_CONTENT } from './content';
import type { NoGameState as OdysseeState } from '../../../engine/sdk/public-api';

type RuleContext = GameContext<OdysseeState>;

export type OdysseeMove = PawnMove & {
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
    const moves = odysseeMoves(actor.id, value, ctx);
    if (moves.length === 0) {
      ctx.events.message('game.pawn.no-legal-move', { playerId: actor.id });
      endMove(ctx, value);
      return;
    }
    if (moves.length === 1) {
      moveOdysseePawn(state, actor.id, moves[0], ctx);
      if (ctx.match.lifecycle() !== 'finished') endMove(ctx, value);
      return;
    }
    ctx.choice.one({
      id: 'odyssee.move',
      player: actor.id,
      options: moves,
      label: (move) => `${pawnName(pawnIndex(move.pawnId))} → ${move.to}`,
    });
  },
  documentation: 'Lance le dé et déplace automatiquement ou demande un pion.',
});

export const ODYSSEE_ACTIONS = { roll };

export function odysseeMoves(
  playerId: number,
  rollValue: number,
  ctx: RuleContext,
): OdysseeMove[] {
  return ctx.pawns.legalMoves('odyssee', playerId, rollValue).map((move) => ({
    ...move,
    roll: rollValue,
  }));
}

export function moveOdysseePawn(
  _state: OdysseeState,
  playerId: number,
  move: OdysseeMove,
  ctx: RuleContext,
): void {
  const arrival = ODYSSEE_CONTENT.trackLength + ODYSSEE_CONTENT.homeLength - 1;
  ctx.pawns.applyRaceMove('odyssee', playerId, move, {
    finishAt: arrival,
    afterMove: () =>
      ctx.events.message('game.pawn.moved', {
        playerId,
        pawnId: move.pawnId,
        target: move.to,
      }),
    onFinish: () =>
      ctx.match.finish({ winners: [playerId], reason: 'all-pawns-arrived' }),
  });
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

function pawnIndex(pawnId: string): number {
  return Number(pawnId.split(':')[1]);
}
