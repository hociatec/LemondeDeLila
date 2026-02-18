import {
  clearPendingState,
  createPendingState,
  isPendingType,
  PendingActionService,
  resolvePendingState,
} from './pending-action.service';

describe('PendingActionService', () => {
  it('stores and returns per-player pending action', () => {
    const service = new PendingActionService<{ type: string }>();
    service.set(1, { type: 'draw' });
    expect(service.get(1)).toEqual({ type: 'draw' });
    expect(service.get(2)).toBeUndefined();
  });

  it('clears pending action for a player', () => {
    const service = new PendingActionService<{ type: string }>();
    service.set(1, { type: 'draw' });
    service.clear(1);
    expect(service.get(1)).toBeUndefined();
  });

  it('creates and clears pending state on game state', () => {
    const state = { status: 'started', pending: null } as any;
    const withPending = createPendingState(state, {
      type: 'draw',
      playerId: 1,
      blocking: true,
    } as any);
    expect(isPendingType(withPending as any, 'draw')).toBe(true);

    const cleared = clearPendingState(withPending as any);
    expect(cleared.pending).toBeNull();
  });

  it('resolves pending state then clears it', () => {
    const state = {
      status: 'started',
      pending: { type: 'choose_target', playerId: 1, blocking: true },
      metadata: { ok: true },
    } as any;

    const out = resolvePendingState(state, (next, pending) => ({
      ...next,
      metadata: { ...(next.metadata ?? {}), resolvedType: pending.type },
    }));

    expect(out.pending).toBeNull();
    expect(out.metadata).toMatchObject({ ok: true, resolvedType: 'choose_target' });
  });
});
