import { SOUND_CATALOG } from './sound-catalog.record';
import { SOUND_KEYS } from './sound-manifest.record';

describe('SOUND_CATALOG', () => {
  it('documents every configurable sound exactly once', () => {
    const ids = SOUND_CATALOG.map((item) => item.soundId);

    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...SOUND_KEYS].sort());
    expect(
      SOUND_CATALOG.every((item) => item.category && item.screen && item.event),
    ).toBe(true);
  });
});
