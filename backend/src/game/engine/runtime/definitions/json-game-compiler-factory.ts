import type { JsonEngineExtensionCatalog } from '../contracts/json-engine-extension-catalog';
import { freezeAuthorSchema } from '../contracts/json-author-schema';
import { AuthoringError } from '../contracts/authoring-error';
import { compileJsonGame } from './json-game-compiler';
import { parseJsonGame } from './json-game-parser';
import { createJsonGameSchema, jsonGameSchema } from './json-game-schema';

/** A private, immutable catalogue per compiler; no process-wide registration. */
export function createJsonGameCompiler<
  const Catalog extends JsonEngineExtensionCatalog = readonly [],
>(candidateExtensions?: Catalog) {
  const entries: readonly Catalog[number][] = candidateExtensions ?? [];
  const documentKeys = new Set(Object.keys(jsonGameSchema.properties ?? {}));
  documentKeys.add('extensions');
  const outputKeys = new Set(['actions', 'events', 'components', 'patterns']);
  const victoryKinds = new Set<string>();
  const reserve = (set: Set<string>, key: string, path: string) => {
    if (
      !key ||
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      set.has(key)
    )
      throw new AuthoringError(
        path,
        'unique nonreserved extension key',
        key,
        `Duplicate or reserved extension key: ${key}`,
      );
    set.add(key);
  };
  const extensions = Object.freeze(
    entries.map((extension, index) => {
      reserve(
        documentKeys,
        extension.documentKey,
        `catalog[${index}].documentKey`,
      );
      reserve(outputKeys, extension.outputKey, `catalog[${index}].outputKey`);
      if (extension.victoryKind) {
        if (!extension.victoryKind.startsWith('by-'))
          throw new AuthoringError(
            `catalog[${index}].victoryKind`,
            'by- prefix',
            extension.victoryKind,
            'Extension victory kinds must start with by-',
          );
        reserve(
          victoryKinds,
          extension.victoryKind,
          `catalog[${index}].victoryKind`,
        );
      }
      return Object.freeze({
        ...extension,
        schema: freezeAuthorSchema(structuredClone(extension.schema)),
      });
    }),
  );
  const schema = createJsonGameSchema(extensions);
  const compatibilitySchema = createJsonGameSchema(extensions, true);
  return Object.freeze({
    jsonGameSchema: schema,
    parseJsonGame: (value: unknown, path = 'game.json') =>
      parseJsonGame(value, path, compatibilitySchema),
    compileJsonGame: (
      manifest: Parameters<typeof compileJsonGame>[0],
      source: unknown,
      assets?: Parameters<typeof compileJsonGame>[2],
      options?: Parameters<typeof compileJsonGame>[3],
    ) => compileJsonGame(manifest, source, assets, options, extensions),
  });
}
