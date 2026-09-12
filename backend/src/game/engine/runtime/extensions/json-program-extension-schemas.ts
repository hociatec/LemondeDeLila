import { jsonProgramExtensions } from './json-program-extension-registry';

/** Schemas are contributed by their extension and composed in stable order. */
export const jsonProgramExtensionSchemas = Object.freeze(
  Object.fromEntries(
    jsonProgramExtensions.map((extension) => [
      extension.documentKey,
      extension.schema,
    ]),
  ),
);
