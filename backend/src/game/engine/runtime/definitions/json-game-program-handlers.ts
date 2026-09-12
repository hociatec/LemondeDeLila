import type { JsonGameDocument as JsonDocument } from './json-game-schema';
import type { CompiledJsonPrograms as Programs } from './json-game-program-compiler';
import { publicField } from '../kits/visibility-kit';
import { boardBot, recipeBot } from './json-program-bots';
import { jsonProgramExtensions } from '../extensions/json-program-extension-registry';
import type {
  JsonExtensionHandlerContext,
  JsonExtensionHandlers,
} from '../contracts/json-program-extension';

export function programHandlers(
  document: JsonDocument,
  programs: Programs,
): JsonExtensionHandlers {
  const sources = new Map<string, unknown>(Object.entries(document));
  const compiledPrograms = new Map<string, unknown>(Object.entries(programs));
  const context: JsonExtensionHandlerContext = {
    recipeBot: (recipe) => recipeBot(document, recipe),
    boardBot: () => boardBot(document),
    publicStatuses: () => ({ statuses: publicField() }),
    actionFor: (availableActions, recipes) =>
      availableActions.find((id) => {
        const action = document.actions[id];
        return (
          typeof action === 'object' &&
          action !== null &&
          'recipe' in action &&
          typeof action.recipe === 'string' &&
          recipes.includes(action.recipe)
        );
      }),
  };
  for (const extension of jsonProgramExtensions) {
    const source = sources.get(extension.documentKey);
    const compiled = compiledPrograms.get(extension.outputKey);
    if (source === undefined || compiled === null || compiled === undefined)
      continue;
    return {
      choices: undefined,
      ...extension.collectHandlers(context, compiled, source),
    };
  }
  return { choices: undefined };
}
