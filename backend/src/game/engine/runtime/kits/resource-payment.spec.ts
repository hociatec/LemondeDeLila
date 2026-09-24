import { quoteResourcePayment } from './resource-payment';
import {
  createPlayerValuesKitState,
  GameResourcesController,
} from './player-values-kit';

it.each([
  ['cancel', false, 0, 3, false],
  ['debt', true, 5, -2, false],
  ['partial', true, 3, 0, false],
  ['eliminate', true, 3, 0, true],
] as const)(
  'settles insufficient funds with the %s policy',
  (policy, accepted, paid, balance, eliminate) => {
    const state = createPlayerValuesKitState();
    const emit = jest.fn();
    const resources = new GameResourcesController(state, emit);
    resources.set(1, 'energy', 3);
    emit.mockClear();
    const before = structuredClone(state);
    const quoted = resources.quote(1, 'energy', 5, policy);
    expect(state).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
    expect(quoted).toEqual({
      accepted,
      paid,
      balance,
      eliminate,
      shortfall: 2,
    });
    expect(resources.settle(1, 'energy', 5, policy)).toEqual(quoted);
    expect(resources.get(1, 'energy')).toBe(balance);
    expect(emit).toHaveBeenCalledTimes(accepted ? 1 : 0);
  },
);

it('agrees with an independent payment model across balances, costs and policies', () => {
  for (let balance = -5; balance <= 50; balance++)
    for (let cost = 0; cost <= 60; cost++)
      for (const policy of [
        'cancel',
        'debt',
        'partial',
        'eliminate',
      ] as const) {
        const result = quoteResourcePayment(balance, cost, policy);
        const available = balance > 0 ? balance : 0;
        const insufficient = cost > available;
        const expectedPaid =
          insufficient && policy === 'cancel'
            ? 0
            : policy === 'debt' || !insufficient
              ? cost
              : available;
        expect(result.paid).toBe(expectedPaid);
        expect(result.balance + result.paid).toBe(balance);
        expect(result.shortfall).toBe(insufficient ? cost - available : 0);
        expect(result.eliminate).toBe(insufficient && policy === 'eliminate');
      }
});

it.each([-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid costs %s without mutation or events',
  (amount) => {
    const state = createPlayerValuesKitState();
    const emit = jest.fn();
    const resources = new GameResourcesController(state, emit);
    const before = structuredClone(state);
    expect(() => resources.settle(1, 'new-resource', amount, 'debt')).toThrow();
    expect(state).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
  },
);
