import {
  assignPawnSelection,
  validatePawnSelectionGroups,
} from './pawn-selection-groups';

it('rejects empty groups, duplicate group IDs and overlapping pawn ownership', () => {
  const group = { id: 'family', label: 'Family', pawnIds: ['a', 'b'] };
  for (const groups of [
    [],
    [{ ...group, pawnIds: [] }],
    [group, group],
    [group, { ...group, id: 'other' }],
  ])
    expect(() => validatePawnSelectionGroups(groups)).toThrow();
});

it('captures group definitions without retaining the author array', () => {
  const source = [{ id: 'family', label: 'Family', pawnIds: ['a', 'b'] }];
  const groups = validatePawnSelectionGroups(source);
  source[0].pawnIds.push('c');
  source[0].label = 'Changed';
  expect(groups).toEqual([
    { id: 'family', label: 'Family', pawnIds: ['a', 'b'] },
  ]);
  expect(Object.isFrozen(groups[0].pawnIds)).toBe(true);
});

it.each(['missing', 'unavailable', 'capacity'])(
  'rejects %s groups before assigning any pawn',
  (failure) => {
    const assign = jest.fn();
    const ctx = {
      pawns: {
        assign,
        available: () =>
          failure === 'unavailable'
            ? [{ id: 'a' }]
            : [{ id: 'a' }, { id: 'b' }],
        assigned: () => [],
        perPlayer: () => (failure === 'capacity' ? 1 : 2),
      },
    };
    expect(() =>
      assignPawnSelection(
        'set',
        failure === 'missing' ? 'unknown' : 'family',
        1,
        ctx as never,
        [{ id: 'family', label: 'Family', pawnIds: ['a', 'b'] }],
      ),
    ).toThrow();
    expect(assign).not.toHaveBeenCalled();
  },
);

it('assigns a validated family in declared pawn order', () => {
  const assign = jest.fn();
  const ctx = {
    pawns: {
      assign,
      available: () => [{ id: 'a' }, { id: 'b' }],
      assigned: () => [],
      perPlayer: () => 2,
    },
  };
  assignPawnSelection('set', 'family', -1, ctx as never, [
    { id: 'family', label: 'Family', pawnIds: ['b', 'a'] },
  ]);
  expect(assign.mock.calls).toEqual([
    ['set', -1, 'b'],
    ['set', -1, 'a'],
  ]);
});
