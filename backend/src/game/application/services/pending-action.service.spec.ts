import {
  clearPendingState,
  createPendingState,
  getPendingType,
  isPendingType,
  PendingActionService,
  resolvePendingState,
} from './pending-action.service';

describe('PendingActionService helpers', () => {
  it('creates and clears pending state', () => {
    const state: any = { pending: null };
    const next = createPendingState(state, {
      type: 'choice',
      playerId: 1,
      data: { foo: 'bar' },
    } as any);
    expect(next.pending).toEqual({
      type: 'choice',
      playerId: 1,
      data: { foo: 'bar' },
    });
    expect(getPendingType(next)).toBe('choice');
    expect(isPendingType(next, 'choice')).toBe(true);
    expect(clearPendingState(next).pending).toBeNull();
  });

  it('resolves pending state after clearing it', () => {
    const state: any = {
      pending: { type: 'x', playerId: 2, data: {} },
    };
    const resolved = resolvePendingState(state, (cleared, pending) => ({
      ...cleared,
      metadata: { pendingType: pending.type },
    }));
    expect(resolved.pending).toBeNull();
    expect((resolved as any).metadata.pendingType).toBe('x');
  });
});

describe('PendingActionService class', () => {
  it('stores actions per player', () => {
    const service = new PendingActionService<string>();
    service.set(1, 'attack');
    expect(service.get(1)).toBe('attack');
    service.clear(1);
    expect(service.get(1)).toBeUndefined();
  });
});
