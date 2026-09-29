import type { JsonGameDocument as JsonDocument } from './json-game-schema';
import type { CompiledJsonPrograms as Programs } from './json-game-program-compiler';
import {
  countOnly,
  hidden,
  privateByPlayer,
  publicField,
  type VisibilityRule,
} from '../kits/visibility-kit';
import { AuthoringError } from '../contracts/authoring-error';
import {
  declarativeBot,
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
  const result: JsonEffectPackHandlers<JsonGameViewAugmentation<Catalog>> = {
    ...(document.bot ? { bot: declarativeBot(document.bot) } : {}),
    ...(document.playerValuesVisibility
      ? {
          playerValuesVisibility: {
            scores: mapVisibility(document.playerValuesVisibility.scores),
            statuses: mapVisibility(document.playerValuesVisibility.statuses),
            resources: mapVisibilityRecord(
              document.playerValuesVisibility.resources,
            ),
            counters: mapVisibilityRecord(
              document.playerValuesVisibility.counters,
            ),
          },
        }
      : {}),
  };
  const owners = new Map<string, string>();
  if (document.bot) owners.set('bot', 'bot');
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

function mapVisibilityRecord(
  source: Readonly<Record<string, string | undefined>> | undefined,
): Record<string, VisibilityRule> | undefined {
  if (!source) return undefined;
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, value]) => {
      const rule = mapVisibility(value);
      return rule ? [[key, rule]] : [];
    }),
  );
}

function mapVisibility(value: string | undefined): VisibilityRule | undefined {
  if (value === 'public') return publicField();
  if (value === 'hidden') return hidden();
  if (value === 'private-by-player') return privateByPlayer();
  if (value === 'count-only') return countOnly();
  return undefined;
}
