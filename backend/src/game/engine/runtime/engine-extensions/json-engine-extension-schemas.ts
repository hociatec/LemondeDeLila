import type { JsonEngineExtensionCatalog } from '../contracts/json-engine-extension-catalog';
export const engineExtensionSchemas = (
  extensions: JsonEngineExtensionCatalog,
) =>
  Object.freeze(
    Object.fromEntries(
      extensions.map((extension) => [extension.documentKey, extension.schema]),
    ),
  );
