import { discoverGameDefinitions } from '../../composition/game-module-discovery';
import { parseJsonGame, jsonGameSchema } from '../public-api';
import { jsonEffectPacks } from './json-effect-pack-registry';
import { stableContentVersion } from '../../engine/runtime/content/content-version';

it('publishes a closed core schema without any pack-specific root field', () => {
  for (const pack of jsonEffectPacks)
    expect(Object.hasOwn(jsonGameSchema.properties, pack.documentKey)).toBe(
      false,
    );
  expect(jsonGameSchema.properties.extensions).toBeDefined();
});

it.each(
  discoverGameDefinitions().map(
    (definition) => [definition.id, definition] as const,
  ),
)(
  '%s preserves compiled content and its digest through the generic extension format',
  (id, definition) => {
    expect(definition.content).toBeDefined();
    const source: Record<string, unknown> = { ...definition.content?.data };
    const legacy = parseJsonGame(source);
    const extensions = jsonEffectPacks.flatMap((pack) => {
      if (!Object.hasOwn(source, pack.documentKey)) return [];
      const config = source[pack.documentKey];
      delete source[pack.documentKey];
      return [{ type: pack.documentKey, config }];
    });
    const normalized = parseJsonGame({ ...source, extensions });
    expect(normalized).toEqual(legacy);
    expect(stableContentVersion(id, normalized)).toBe(
      stableContentVersion(id, legacy),
    );
  },
);
