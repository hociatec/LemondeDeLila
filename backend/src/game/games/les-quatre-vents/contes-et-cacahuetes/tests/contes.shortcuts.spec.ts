import { buildContesShortcuts } from '../contes.shortcuts';

describe('ContesShortcuts', () => {
  it('declares draw, score and position shortcuts', () => {
    const shortcuts = buildContesShortcuts();
    expect(Array.isArray(shortcuts)).toBe(true);
    expect(
      shortcuts.some(
        (s: any) => String(s?.type) === 'action' && String(s?.actionType) === 'draw',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (s: any) => String(s?.type) === 'interface' && String(s?.id) === 'score',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (s: any) => String(s?.type) === 'interface' && String(s?.id) === 'position',
      ),
    ).toBe(true);
  });
});
