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
import { assertBoardPawnCapacity } from './json-board-pawn-capacity';
import { jsonProgramInitialization } from './json-program-initialization';
import {
  standardVictory,
  assertStandardVictoryReferences,
} from './json-standard-victory';
import { compileJsonActions } from './json-game-action-compiler';
import { assertProgramReferences } from './json-program-reference-validation';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { assertGameManifestMatches } from '../../../core/application/helpers/game-manifest-validation';
import type { JsonGameManifest } from './json-game-manifest';

export type { JsonGameManifest } from './json-game-manifest';

export function compileJsonGame(
  manifest: JsonGameManifest,
  source: unknown,
  assets?: JsonContentAssets,
) {
  assertGameManifestMatches(manifest, manifest);
  if (!manifest.code.trim())
    throw new GameConfigurationError('Empty JSON game identifier');
  const resolvedSource = resolveJsonContent(source, assets);
  const metadata = parseJsonGame(resolvedSource);
  const content = defineGameContent(manifest.code, resolvedSource, {
    version: metadata.contentVersion,
    formatVersion: 1,
    snapshotMigrations: metadata.snapshotMigrations,
    schema: { parse: parseJsonGame },
  });
  const document = content.data;
  const fail = (path: string, reason: string): never => {
    throw new GameConfigurationError(`${manifest.code}.${path}: ${reason}`);
  };
  const programs = compileJsonPrograms(document);
  const {
    grid,
    judged,
    patterns,
    collectionRace,
    ecosystemRace,
    nawak,
    mnemosyne,
  } = programs;
  assertDocumentReferences(document, patterns, manifest, fail);
  const actions = compileJsonActions(document, programs, fail);
  const events = [
    ...(grid?.events ?? []),
    ...(judged?.events ?? []),
    ...(collectionRace?.events ?? []),
    ...(ecosystemRace?.events ?? []),
    ...(nawak?.events ?? []),
    ...(mnemosyne?.events ?? []),
    ...(programs.sac?.events ?? []),
  ];
  const components = [...document.components, ...(mnemosyne?.components ?? [])];
  for (const program of [
    programs.corridor,
    programs.catPattes,
    programs.contes,
    programs.rites,
    programs.sac,
  ])
    components.push(
      ...(program?.components ?? []).filter(
        (component) => component.component !== 'cards.zone',
      ),
    );
  const handlers = programHandlers(document, programs);
  const buildDefinition = () =>
    defineGame<Record<string, never>>()<
      typeof actions,
      JsonGameViewExtension,
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
      initialization: jsonProgramInitialization(document),
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
type JsonGameViewExtension = {
  progress?: Readonly<Record<number, unknown>>;
  currentChallengeId?: string;
  lastRound?: unknown;
  currentTheme?: string | null;
  secondTheme?: string | null;
  buildings?: Readonly<Record<number, unknown>>;
};

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
): void {
  const resources = new Set(document.resourceIds);
  assertStandardVictoryReferences(
    document.victory,
    [
      ...document.components,
      ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
    ],
    resources,
    fail,
  );
  assertProgramReferences(document, patterns, manifest, fail);
  assertBoardPawnCapacity(document, manifest.maxPlayers, fail);
  assertSelections(document, patterns, fail);
  for (const [id, action] of Object.entries(document.actions)) {
    if ('recipe' in action && action.recipe === 'grid-place' && !document.grid)
      fail(`actions.${id}`, 'grid required');
    if (
      'recipe' in action &&
      action.recipe.startsWith('board-') &&
      !document.board
    )
      fail(`actions.${id}`, 'board required');
    if (
      'recipe' in action &&
      action.recipe.startsWith('judged-') &&
      !document.judgedCards
    )
      fail(`actions.${id}`, 'judged card program required');
  }
  for (const shortcut of document.shortcuts ?? []) {
    if (
      shortcut.type === 'action' &&
      !Object.hasOwn(document.actions, shortcut.actionType)
    )
      fail('shortcuts', 'unknown action');
  }
  if (resources.size !== document.resourceIds.length)
    fail('resourceIds', 'duplicate resource');
  for (const resource of Object.keys(document.setup.resources ?? {})) {
    if (!resources.has(resource))
      fail('setup.resources', `unknown resource ${resource}`);
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
): void {
  const choices = new Set<string>(
    [
      document.board?.pawnSelection?.choiceId,
      document.board?.directionChoiceId,
      document.board?.quiz?.choiceId,
      document.board?.exchange?.takeChoiceId,
      document.board?.exchange?.giveChoiceId,
      document.grid?.pawnSelection?.choiceId,
      document.eventRace?.pawnSelection.choiceId,
      document.pawnRace?.choiceId,
    ].filter((id): id is string => id !== undefined),
  );
  for (const action of Object.values(document.actions)) {
    if (!('selectCards' in action)) continue;
    const program = action.selectCards;
    if (choices.has(program.choiceId) || program.choiceId.startsWith('engine.'))
      fail('actions.selectCards.choiceId', 'duplicate or reserved choice');
    choices.add(program.choiceId);
    assertCardSelectionReferences(program, [
      ...document.components,
      ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
    ]);
  }
}
