import { deriveGameShortcuts } from './runtime-descriptor';

describe('runtime shortcut safety', () => {
  const button = { describe: () => ({ type: 'object', properties: {} }) };

  it('reserves Enter for the client dice control and removes dice shortcuts', () => {
    const definition = {
      shortcuts: [
        { key: 'Space', type: 'action', actionType: 'roll' },
        { key: 'D', type: 'action', actionType: 'roll' },
        { key: 'Enter', type: 'action', actionType: 'pass' },
        { key: 'Enter', type: 'interface', id: 'details' },
      ],
      actions: {
        roll: { input: button },
        pass: { input: button },
      },
    };

    expect(deriveGameShortcuts(definition as never)).toEqual([]);
  });

  it('keeps Space available for a non-dice action', () => {
    const definition = {
      shortcuts: [],
      actions: { draw: { input: button } },
    };

    expect(deriveGameShortcuts(definition as never)).toEqual([
      { key: 'Space', type: 'action', actionType: 'draw' },
    ]);
  });
});
