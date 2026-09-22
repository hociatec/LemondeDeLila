import type { JsonGameDocument as JsonDocument } from './json-game-schema';
import type { CompiledJsonPrograms as Programs } from './json-game-program-compiler';
import { publicField } from '../kits/visibility-kit';
import {
  fallbackRecipeBot,
  recipeBot,
  selectedRecipeBot,
} from './json-program-bots';
import type { JsonEffectPackCatalog } from '../contracts/json-effect-pack-catalog';
import type {
  JsonEffectPackHandlerContext,
  JsonEffectPackHandlers,
} from '../contracts/json-effect-pack';

export function programHandlers(
  document: JsonDocument,
  programs: Programs,
  jsonEffectPacks: JsonEffectPackCatalog = [],
): JsonEffectPackHandlers {
  const sources = new Map<string, unknown>(Object.entries(document));
  const compiledPrograms = new Map<string, unknown>(Object.entries(programs));
  const context: JsonEffectPackHandlerContext = {
    selectedBot: (select) => selectedRecipeBot(document, select),
    recipeBot: (recipe) => recipeBot(document, recipe),
    fallbackRecipeBot: (preferred) => fallbackRecipeBot(document, preferred),
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
  for (const extension of jsonEffectPacks) {
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
