import type { JsonEffectPackCatalog } from '../contracts/json-effect-pack-catalog';
import { freezeAuthorSchema } from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { compileJsonGame } from './json-game-compiler';
import { parseJsonGame } from './json-game-parser';
import { createJsonGameSchema, jsonGameSchema } from './json-game-schema';

/** A private, immutable catalogue per compiler; no process-wide registration. */
export function createJsonGameCompiler(extensions: JsonEffectPackCatalog = []) {
  const documentKeys = new Set(Object.keys(jsonGameSchema.properties ?? {}));
  const outputKeys = new Set(['actions', 'events', 'components', 'patterns']);
  const victoryKinds = new Set<string>();
  const reserve = (set: Set<string>, key: string) => {
    if (
      !key ||
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      set.has(key)
    )
      throw new GameConfigurationError(
        `Duplicate or reserved extension key: ${key}`,
      );
    set.add(key);
  };
  const packs = Object.freeze(
    extensions.map((extension) => {
      reserve(documentKeys, extension.documentKey);
      reserve(outputKeys, extension.outputKey);
      if (extension.victoryKind) {
        if (!extension.victoryKind.startsWith('by-'))
          throw new GameConfigurationError(
            'Extension victory kinds must start with by-',
          );
        reserve(victoryKinds, extension.victoryKind);
      }
      return Object.freeze({
        ...extension,
        schema: freezeAuthorSchema(structuredClone(extension.schema)),
      });
    }),
  );
  const schema = createJsonGameSchema(packs);
  return Object.freeze({
    jsonGameSchema: schema,
    parseJsonGame: (value: unknown, path = 'game.json') =>
      parseJsonGame(value, path, schema),
    compileJsonGame: (
      manifest: Parameters<typeof compileJsonGame>[0],
      source: unknown,
      assets?: Parameters<typeof compileJsonGame>[2],
      options?: Parameters<typeof compileJsonGame>[3],
    ) => compileJsonGame(manifest, source, assets, options, packs),
  });
}
