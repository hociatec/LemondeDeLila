import { programHandlers } from './json-game-program-handlers';
import { cardSelectionRules } from '../recipes/gameplay/card-selection.recipes';
import { assertCardSelectionReferences } from './json-card-selection-schema';
import { defineGame } from './game-definition';
import { defineGameContent } from '../content/game-content';
import {
  resolveJsonContent,
  type JsonContentAssets,
} from '../content/json-content-bundle';
import { parseJsonGame } from './json-game-parser';
import { compileJsonPattern } from './json-game-patterns';
import { compileJsonPrograms } from './json-game-program-compiler';
import { jsonProgramInitialization } from './json-program-initialization';
import {
  standardVictory,
  assertStandardVictoryReferences,
} from './json-standard-victory';
import { compileJsonActions } from './json-game-action-compiler';
import { assertProgramReferences } from './json-program-reference-validation';
import { AuthoringError, authoringValueAt } from '../contracts/authoring-error';
import {
  DefinitionValidationError,
  jsonDefinitionFailure,
  jsonCompilationOrigin,
} from './definition-validation-error';
import {
  authoringProperty,
  assertUniqueAuthorValues,
} from '../contracts/authoring-diagnostics';
import { assertGameManifestMatches } from '../../../core/application/helpers/game-manifest-validation';
import type { JsonGameManifest } from './json-game-manifest';
import type {
  JsonEffectPackCatalog,
  JsonGameViewAugmentation,
} from '../contracts/json-effect-pack-catalog';

import { createJsonGameSchema } from './json-game-schema';

export type { JsonGameManifest } from './json-game-manifest';

export function compileJsonGame<
  Catalog extends JsonEffectPackCatalog = readonly [],
>(
  manifest: JsonGameManifest,
  source: unknown,
  assets?: JsonContentAssets,
  options: { externalContent?: boolean } = {},
  jsonEffectPacks?: Catalog,
) {
  const resolvedSource = resolveJsonContent(source, assets);
  try {
    return compileResolvedJsonGame(
      manifest,
      resolvedSource,
      options,
      jsonEffectPacks ?? [],
    );
  } catch (caught) {
    let error: unknown = caught;
    const field = jsonCompilationOrigin(error, manifest.code, resolvedSource);
    if (error instanceof Error && field !== undefined) {
      error = new AuthoringError(
        `game.json.${field}`,
        error.message,
        authoringValueAt(resolvedSource, field),
      );
    }
    if (error instanceof DefinitionValidationError) {
      const field = jsonDefinitionFailure(error, resolvedSource);
      if (field !== undefined)
        error = new AuthoringError(
          `game.json.${field}`,
          error.reason,
          authoringValueAt(resolvedSource, field),
        );
    }
    if (!(error instanceof AuthoringError)) throw error;
    const extensions = authoringValueAt(resolvedSource, 'extensions');
    if (Array.isArray(extensions)) {
      for (const [index, extension] of extensions.entries()) {
        const type = authoringValueAt(extension, 'type');
        if (typeof type !== 'string') continue;
        const prefix = `game.json.${type}`;
        if (
          error.path !== prefix &&
          !error.path.startsWith(`${prefix}.`) &&
          !error.path.startsWith(`${prefix}[`)
        )
          continue;
        const path = `game.json.extensions[${index}].config${error.path.slice(prefix.length)}`;
        throw new AuthoringError(
          path,
          error.expected,
          authoringValueAt(resolvedSource, path.slice('game.json.'.length)),
          error.message.slice(error.path.length + 2),
          error.hint,
        );
      }
    }
    throw error;
  }
}

function compileResolvedJsonGame<Catalog extends JsonEffectPackCatalog>(
  manifest: JsonGameManifest,
  resolvedSource: unknown,
  options: { externalContent?: boolean },
  jsonEffectPacks: Catalog,
) {
  assertGameManifestMatches(manifest, manifest, (field, received) => {
    throw new AuthoringError(
      field ? `manifest.${field}` : 'manifest',
      'valid game manifest metadata',
      received,
    );
  });
  if (!manifest.code.trim())
    throw new AuthoringError(
      'manifest.code',
      'nonempty identifier',
      manifest.code,
      'Empty JSON game identifier',
    );
  const schema = createJsonGameSchema(jsonEffectPacks, true);
  const parse = (value: unknown) => parseJsonGame(value, 'game.json', schema);
  const metadata = parse(resolvedSource);
  const content = defineGameContent(manifest.code, resolvedSource, {
    externalContent: options.externalContent,
    version: metadata.contentVersion,
    formatVersion: 1,
    snapshotMigrations: metadata.snapshotMigrations,
    schema: { parse },
  });
  const document = content.data;
  const fail = (path: string, reason: string): never => {
    throw new AuthoringError(
      `game.json.${path}`,
      reason,
      authoringValueAt(document, path),
    );
  };
  const programs = compileJsonPrograms(document, jsonEffectPacks);
  const { patterns } = programs;
  assertDocumentReferences(document, patterns, manifest, fail, jsonEffectPacks);
  const actions = compileJsonActions(document, programs, fail);
  const events = programs.events;
  const components = [...document.components, ...programs.components];
  const handlers = programHandlers(document, programs, jsonEffectPacks);
  const buildDefinition = () =>
    defineGame<Record<string, never>>()<
      typeof actions,
      JsonGameViewAugmentation<Catalog>,
      typeof document.setup,
      typeof events,
      NonNullable<typeof patterns>,
      typeof components,
      typeof document.resourceIds
    >({
      id: manifest.code,
      displayName: manifest.name,
      description: manifest.summary,
      category: document.category,
      subcategory: document.world,
      players: { min: manifest.minPlayers, max: manifest.maxPlayers },
      presentation: document.presentation,
      content,
      events,
      rulesVersion: document.definitionVersion,
      patterns,
      shortcuts: document.shortcuts,
      components,
      initialization: jsonProgramInitialization(document, jsonEffectPacks),
      resourceIds: document.resourceIds,
      initialPhase: document.initialPhase,
      phases: document.phases,
      actions,
      ...handlers,
      choices: selectionChoices(document, handlers.choices),
      ...(isProgramVictory(document.victory)
        ? {}
        : { victory: standardVictory(document.victory) }),
    });
  return buildDefinition();
}

type JsonDocument = ReturnType<typeof parseJsonGame>;
type JsonFailure = (path: string, reason: string) => never;
function isProgramVictory(
  victory: JsonDocument['victory'],
): victory is Extract<JsonDocument['victory'], { kind: `by-${string}` }> {
  return victory.kind.startsWith('by-');
}

function selectionChoices(
  document: JsonDocument,
  inherited: ReturnType<typeof programHandlers>['choices'],
) {
  return {
    ...inherited,
    ...Object.fromEntries(
      Object.values(document.actions).flatMap((action) =>
        'selectCards' in action
          ? [
              [
                action.selectCards.choiceId,
                cardSelectionRules(action.selectCards).choice,
              ],
            ]
          : [],
      ),
    ),
  };
}

function assertDocumentReferences(
  document: JsonDocument,
  patterns: ReturnType<typeof compileJsonPattern>[] | undefined,
  manifest: JsonGameManifest,
  fail: JsonFailure,
  jsonEffectPacks: JsonEffectPackCatalog,
): void {
  const resources = new Set([
    ...document.resourceIds,
    ...document.components
      .filter((component) => component.component === 'resource.pool')
      .map((component) => component.id),
  ]);
  assertStandardVictoryReferences(
    document.victory,
    [
      ...document.components,
      ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
    ],
    resources,
    fail,
    new Set(Object.keys(document.phases ?? {})),
  );
  assertProgramReferences(document, patterns, manifest, fail, jsonEffectPacks);
  assertSelections(document, patterns, fail, jsonEffectPacks);
  for (const [index, shortcut] of (document.shortcuts ?? []).entries()) {
    if (
      shortcut.type === 'action' &&
      !Object.hasOwn(document.actions, shortcut.actionType)
    )
      fail(`shortcuts[${index}].actionType`, 'unknown action');
  }
  assertUniqueAuthorValues(
    document.resourceIds,
    (i) => `resourceIds[${i}]`,
    fail,
  );
  for (const resource of Object.keys(document.setup.resources ?? {})) {
    if (!resources.has(resource))
      fail(
        authoringProperty('setup.resources', resource),
        `unknown resource ${resource}`,
      );
  }
  if (
    document.victory.kind === 'resource-at-least' &&
    !resources.has(document.victory.resource)
  )
    fail('victory.resource', `unknown resource ${document.victory.resource}`);
}

function assertSelections(
  document: JsonDocument,
  patterns: ReturnType<typeof compileJsonPattern>[] | undefined,
  fail: JsonFailure,
  jsonEffectPacks: JsonEffectPackCatalog,
): void {
  const sources = new Map<string, unknown>(Object.entries(document));
  const choices = new Set<string>();
  for (const extension of jsonEffectPacks) {
    const source = sources.get(extension.documentKey);
    if (source === undefined) continue;
    for (const choiceId of extension.collectChoiceIds(source))
      if (choiceId !== undefined) choices.add(choiceId);
  }
  for (const [actionId, action] of Object.entries(document.actions)) {
    if (!('selectCards' in action)) continue;
    const program = action.selectCards;
    if (choices.has(program.choiceId) || program.choiceId.startsWith('engine.'))
      fail(
        `${authoringProperty('actions', actionId)}.selectCards.choiceId`,
        'duplicate or reserved choice',
      );
    choices.add(program.choiceId);
    assertCardSelectionReferences(
      program,
      [
        ...document.components,
        ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
      ],
      `${authoringProperty('game.json.actions', actionId)}.selectCards`,
    );
  }
}
