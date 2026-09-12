import {
  createOwnershipKitState,
  GameOwnershipController,
  ownership,
} from './ownership-kit';

function fixture() {
  const state = createOwnershipKitState();
  const emit = jest.fn();
  const kit = new GameOwnershipController(state, emit);
  kit.create(ownership.registry({ id: 'land', assets: ['house'] }));
  kit.claim('land', 'house', 1);
  emit.mockClear();
  return { state, emit, kit };
}

it.each(['__proto__', 'constructor', 'prototype', 'toString'])(
  'rejects unsafe ownership catalog identifier %s',
  (id) => {
    expect(() => ownership.registry({ id, assets: ['house'] })).toThrow();
    expect(() => ownership.registry({ id: 'land', assets: [id] })).toThrow();
  },
);

it.each([0, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid owner %s before releasing ownership',
  (id) => {
    const { state, emit, kit } = fixture();
    const before = structuredClone(state);
    expect(() => kit.transfer('land', 'house', 1, id)).toThrow();
    expect(state).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
  },
);

it.each([null, '1', [0], [1, 1], [1, 2], [NaN]].map((owners) => ({ owners })))(
  'rejects malformed restored owners %j',
  ({ owners }) => {
    const { state, kit } = fixture();
    Object.assign(state.owners.land, { house: owners });
    expect(() => kit.assertValid()).toThrow();
  },
);

it('rejects unknown registries and supports signed bot ownership', () => {
  const { state, kit } = fixture();
  kit.transfer('land', 'house', 1, -2);
  expect(kit.ownerOf('land', 'house')).toBe(-2);
  expect(() => kit.assertValid()).not.toThrow();
  state.owners.unknown = {};
  expect(() => kit.assertValid()).toThrow();
});

it('releases assets in the canonical definition order after JSON key reordering', () => {
  const definition = ownership.registry({
    id: 'land',
    assets: ['north', 'center', 'south'],
  });
  const state = {
    owners: {
      land: {
        south: [1],
        north: [1],
        center: [1],
      },
    },
  };
  const emit = jest.fn();
  const kit = new GameOwnershipController(state, emit, [definition]);

  expect(kit.assetsOf('land', 1)).toEqual(['north', 'center', 'south']);
  expect(kit.releaseAll('land', 1)).toEqual(['north', 'center', 'south']);
  expect(emit.mock.calls.map(([, event]) => event.assetId)).toEqual([
    'north',
    'center',
    'south',
  ]);
});
