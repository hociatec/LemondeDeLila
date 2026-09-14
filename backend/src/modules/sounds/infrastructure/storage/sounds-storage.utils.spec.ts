import { decodeSoundManifest } from './sounds-storage.utils';

describe('decodeSoundManifest', () => {
  it('keeps old manifests compatible by defaulting disabled to empty', () => {
    expect(
      decodeSoundManifest({
        updatedAt: '2026-09-14T00:00:00.000Z',
        sounds: {},
      }),
    ).toEqual({
      updatedAt: '2026-09-14T00:00:00.000Z',
      sounds: {},
      disabled: [],
    });
  });

  it('rejects unknown disabled sound identifiers', () => {
    expect(
      decodeSoundManifest({
        updatedAt: '2026-09-14T00:00:00.000Z',
        sounds: {},
        disabled: ['NotASound'],
      }),
    ).toBeNull();
  });
});
