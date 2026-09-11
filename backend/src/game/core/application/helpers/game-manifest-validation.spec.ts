import { assertGameManifestMatches } from './game-manifest-validation';

const expected = {
  code: 'example',
  name: 'Example',
  minPlayers: 2,
  maxPlayers: 6,
  summary: 'Rules',
};
const manifest = { ...expected, engine: expected.code };

it('accepts matching compiled and installed metadata', () => {
  expect(() => assertGameManifestMatches(manifest, expected)).not.toThrow();
});

it.each([
  null,
  { ...manifest, code: 'other' },
  { ...manifest, engine: 'old-engine' },
  { ...manifest, name: 'Old title' },
  { ...manifest, minPlayers: 1 },
  { ...manifest, maxPlayers: 10 },
  { ...manifest, summary: 'Old rules' },
])('rejects stale or mismatched manifest metadata: %p', (value) => {
  expect(() => assertGameManifestMatches(value, expected)).toThrow('Manifeste');
});
