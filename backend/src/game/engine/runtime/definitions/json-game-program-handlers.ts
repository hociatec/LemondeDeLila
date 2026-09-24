import type { JsonGameDocument as JsonDocument } from './json-game-schema';
import type { CompiledJsonPrograms as Programs } from './json-game-program-compiler';
import { publicField } from '../kits/visibility-kit';
import { AuthoringError } from '../contracts/authoring-error';
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
  const result: JsonEffectPackHandlers<JsonGameViewAugmentation<Catalog>> = {};
  const owners = new Map<string, string>();
  for (const extension of jsonEffectPacks) {
    const source = sources.get(extension.documentKey);
    const contribution = programs.contributions.get(extension.outputKey);
    if (source === undefined || contribution === undefined) continue;
    const handlers = { ...contribution.handlers(context) };
    // JSON selects one victory explicitly. Other extensions cannot override it.
    if (extension.victoryKind !== document.victory.kind)
      delete handlers.victory;
    for (const [key, value] of Object.entries(handlers)) {
      if (value === undefined) {
        Reflect.deleteProperty(handlers, key);
        continue;
      }
      const owner = owners.get(key);
      if (owner)
        throw new AuthoringError(
          `game.json.${extension.documentKey}`,
          `unique handler owner for ${key}; already provided by ${owner}`,
          key,
        );
      owners.set(key, extension.documentKey);
    }
    Object.assign(result, handlers);
  }
  return result;
}
