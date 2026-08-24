import { buildZigEtZagShortcuts } from './zig-et-zag.shortcuts';

describe('ZigEtZagShortcuts', () => {
  it('declares draw and deck info shortcuts', () => {
    const shortcuts = buildZigEtZagShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });
    expect(Array.isArray(shortcuts)).toBe(true);
    expect(
      shortcuts.some(
        (s: any) =>
          s?.type === 'action' &&
          String(s?.actionType).toLowerCase() === 'draw_card' &&
          String(s?.key).toLowerCase() === 'pressed space',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (s: any) =>
          s?.type === 'interface' &&
          String(s?.id).toLowerCase() === 'decks' &&
          String(s?.key).toLowerCase() === 'pressed s',
      ),
    ).toBe(true);
  });
});

