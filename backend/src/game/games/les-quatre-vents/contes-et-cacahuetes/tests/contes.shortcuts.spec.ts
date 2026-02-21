import { buildContesShortcuts } from '../contes.shortcuts';

type ShortcutView = {
  type?: string;
  actionType?: string;
  id?: string;
};

describe('ContesShortcuts', () => {
  it('declares draw, score and position shortcuts', () => {
    const shortcuts = buildContesShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    }) as ShortcutView[];
    expect(Array.isArray(shortcuts)).toBe(true);
    expect(
      shortcuts.some(
        (shortcut) =>
          String(shortcut.type ?? '') === 'action' &&
          String(shortcut.actionType ?? '') === 'draw',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (shortcut) =>
          String(shortcut.type ?? '') === 'interface' &&
          String(shortcut.id ?? '') === 'score',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (shortcut) =>
          String(shortcut.type ?? '') === 'interface' &&
          String(shortcut.id ?? '') === 'position',
      ),
    ).toBe(true);
  });
});
