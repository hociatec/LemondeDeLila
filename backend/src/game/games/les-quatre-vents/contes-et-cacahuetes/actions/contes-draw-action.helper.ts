import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import type { ContesPending } from '../model/contes-et-cacahuetes-state.model';

export function applyContesDrawAction(input: {
  state: GameStateEntity;
  resolveAbondanceDraw: (
    state: GameStateEntity,
    playerId: number,
    data: Record<string, unknown>,
  ) => GameStateEntity;
  resolveQueuedDraw: (
    state: GameStateEntity,
    playerId: number,
    data: Record<string, unknown>,
  ) => GameStateEntity;
}): GameStateEntity {
  const status = String(input.state.status ?? '').toLowerCase();
  if (status !== 'started') return input.state;

  const pending = input.state.pending as ContesPending | null;
  if (!pending || pending.type !== 'draw') return input.state;

  const playerId =
    typeof pending.playerId === 'number'
      ? pending.playerId
      : (input.state.turn?.currentPlayerId ?? null);
  if (playerId == null) return input.state;

  const data = pending.data ?? {};
  const context = String(data.context ?? 'draw_and_apply');
  const next = { ...input.state, pending: null };

  if (context === 'abondance') {
    return input.resolveAbondanceDraw(next, playerId, data);
  }

  return input.resolveQueuedDraw(next, playerId, data);
}




