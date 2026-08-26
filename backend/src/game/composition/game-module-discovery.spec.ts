import { discoverGameDefinitions } from './game-module-discovery';

describe('game module discovery', () => {
  it('discovers every TypeScript game definition directly', () => {
    const definitions = discoverGameDefinitions();
    expect(definitions.map((definition) => definition.id)).toContain('morpion');
    expect(definitions.map((definition) => definition.id)).toContain(
      'dame-nature',
    );
  });

  it('returns the generated registry sorted without duplicate ids', () => {
    const ids = discoverGameDefinitions().map((definition) => definition.id);

    expect(ids).toEqual(
      [...ids].sort((left, right) => left.localeCompare(right)),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
