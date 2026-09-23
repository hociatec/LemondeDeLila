import { consumeFirstProtection } from './protection-cost';
import { settleResourceDelta } from './resource-settlement';
import { firstOtherPlayerAt } from './track-collision';

it('detects collisions independently of penalties, preserving player order and track isolation', () => {
  const positions: Record<string, Record<number, number>> = {
    main: { 1: 4, 2: 4, [-3]: 4, 4: 7 },
    other: { 1: 4, 2: 8, [-3]: 9, 4: 7 },
  };
  const before = structuredClone(positions);
  const ctx = {
    players: {
      all: () => [1, -3, 2, 4].map((id) => ({ id, username: String(id) })),
    },
    movement: { position: (track: string, id: number) => positions[track][id] },
  };
  expect(firstOtherPlayerAt(ctx, 'main', 4, 1)).toBe(-3);
  expect(firstOtherPlayerAt(ctx, 'main', 4, -3)).toBe(1);
  expect(firstOtherPlayerAt(ctx, 'main', 7, 4)).toBeUndefined();
  expect(firstOtherPlayerAt(ctx, 'other', 4, 1)).toBeUndefined();
  expect(positions).toEqual(before);
});

it.each([
  [10, -4, 0, 6, undefined],
  [10, -10, 0, 0, undefined],
  [10, -15, 0, 0, 5],
  [10, 7, 0, 17, undefined],
  [0, -8, -5, -5, 3],
])(
  'settles %s + %s with floor %s independently of the shortfall policy',
  (initial, delta, minimum, expected, shortfall) => {
    const balances = new Map([
      [1, initial],
      [2, 99],
    ]);
    const events: string[] = [];
    const resources = {
      add: (id: number, _resource: string, value: number) => {
        const balance = (balances.get(id) ?? 0) + value;
        balances.set(id, balance);
        events.push('change');
        return balance;
      },
      set: (id: number, _resource: string, value: number) => {
        balances.set(id, value);
        events.push('floor');
        return value;
      },
    };
    const onShortfall = jest.fn((missing: number) => {
      events.push(`shortfall:${missing}`);
      expect(balances.get(1)).toBe(minimum);
    });
    settleResourceDelta(resources, 1, 'energy', delta, {
      minimum,
      afterChange: () => events.push('changed'),
      onShortfall,
    });
    expect(balances.get(1)).toBe(expected);
    expect(balances.get(2)).toBe(99);
    expect(events).toEqual(
      shortfall === undefined
        ? ['change', 'changed']
        : ['change', 'changed', 'floor', `shortfall:${shortfall}`],
    );
    expect(onShortfall).toHaveBeenCalledTimes(shortfall === undefined ? 0 : 1);
  },
);

it.each([
  [true, 2, true, 0, 2, true],
  [false, 2, true, 1, 0, true],
  [false, 1, true, 2, 1, false],
  [false, 1, false, undefined, 1, false],
])(
  'consumes one protection in priority order %#',
  (first, tokens, last, expected, remainingTokens, remainingLast) => {
    const statuses = new Set([
      ...(first ? ['first'] : []),
      ...(last ? ['last'] : []),
    ]);
    let balance = tokens;
    const ctx = {
      resources: {
        has: (_id: number, _resource: string, amount: number) =>
          balance >= amount,
        remove: (_id: number, _resource: string, amount: number) =>
          (balance -= amount),
      },
      status: {
        consume: (_id: number, status: string) => statuses.delete(status),
      },
    };
    expect(
      consumeFirstProtection(ctx, 1, [
        { status: 'first' },
        { resource: 'tokens', amount: 2 },
        { status: 'last' },
      ]),
    ).toBe(expected);
    expect(balance).toBe(remainingTokens);
    expect(statuses.has('last')).toBe(remainingLast);
  },
);
