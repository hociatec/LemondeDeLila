import type { JsonGameDocument as JsonDocument } from './json-game-schema';
import type { CompiledJsonPrograms as Programs } from './json-game-program-compiler';
import { publicField } from '../kits/visibility-kit';
import {
  fallbackRecipeBot,
  recipeBot,
  selectedRecipeBot,
} from './json-program-bots';
import type {
  JsonEffectPackCatalog,
  JsonGameViewAugmentation,
} from '../contracts/json-effect-pack-catalog';
import type {
  JsonEffectPackHandlerContext,
  JsonEffectPackHandlers,
} from '../contracts/json-effect-pack';

export function programHandlers<Catalog extends JsonEffectPackCatalog>(
  document: JsonDocument,
  programs: Programs,
  jsonEffectPacks: Catalog,
): JsonEffectPackHandlers<JsonGameViewAugmentation<Catalog>> {
  const sources = new Map<string, unknown>(Object.entries(document));
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
    const contribution = programs.contributions.get(extension.outputKey);
    if (source === undefined || contribution === undefined) continue;
    // The key comes from this catalogue, whose optional view fields cover each pack.
    return {
      choices: undefined,
      ...contribution.handlers(context),
    };
  }
  return { choices: undefined };
}
