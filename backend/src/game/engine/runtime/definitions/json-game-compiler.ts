import type { DefinedGameAction } from '../contracts/author-rule-contracts';
import { defineAction } from './game-definition-builders';
import { defineGame } from './game-definition';
import { gameInput } from '../actions/game-input-schema';
import { defineGameContent } from '../content/game-content';
import { parseJsonGame } from './json-game-schema';
import { compileJsonPattern } from './json-game-patterns';
import { assertBoardReferences } from './json-board-schema';
import { boardTurnRules } from '../recipes/gameplay/board-turn.recipes';
import { thresholdVictory } from '../automation/threshold-victory';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { assertGameManifestMatches } from '../../../core/application/helpers/game-manifest-validation';

export type JsonGameManifest = {
  code: string;
  engine: string;
  name: string;
  summary: string;
  minPlayers: number;
  maxPlayers: number;
};

/** Compile data once. All executable callbacks are engine-owned. */
export function compileJsonGame(manifest: JsonGameManifest, source: unknown) {
  assertGameManifestMatches(manifest, manifest);
  if (!manifest.code.trim())
    throw new GameConfigurationError('Empty JSON game identifier');
  const content = defineGameContent(manifest.code, source, {
    formatVersion: 1,
    schema: { parse: parseJsonGame },
  });
  const document = content.data;
  const fail = (path: string, reason: string): never => {
    throw new GameConfigurationError(`${manifest.code}.${path}: ${reason}`);
  };
  const patterns = document.patterns?.map(compileJsonPattern);
  assertDocumentReferences(document, patterns, fail);
  const board = document.board ? boardTurnRules(document.board) : null;
  const actions = compileActions(document, board, fail);
  // The common definition validator checks all static effects, including
  // actions, cards, landing effects and their nested conditions/reactions.
  return defineGame<Record<string, never>>()<
    typeof actions,
    object,
    typeof document.setup,
    readonly [],
    NonNullable<typeof patterns>,
    typeof document.components,
    typeof document.resourceIds
  >({
    id: manifest.code,
    displayName: manifest.name,
    description: manifest.summary,
    category: document.category,
    subcategory: document.world,
    players: { min: manifest.minPlayers, max: manifest.maxPlayers },
    content,
    rulesVersion: document.definitionVersion,
    patterns,
    shortcuts: document.shortcuts,
    components: document.components,
    initialization: board
      ? Object.keys(document.setup).length === 0
        ? undefined
        : { ...document.setup, startRound: false }
      : document.setup,
    resourceIds: document.resourceIds,
    initialPhase: document.initialPhase,
    phases: document.phases,
    actions,
    ...(board
      ? {
          setup: board.setup,
          choices: board.choices,
          effects: board.effects,
          automatic: board.automatic,
          bot: {
            choose: ({ availableActions }) => {
              const type =
                availableActions.find(
                  (id) =>
                    'recipe' in document.actions[id] &&
                    document.actions[id].recipe === 'board-draw',
                ) ?? availableActions[0];
              return type ? { type, payload: {} } : null;
            },
          },
        }
      : {}),
    ...(document.victory.kind === 'by-board'
      ? {}
      : { victory: thresholdVictory(document.victory) }),
  });
}

type JsonDocument = ReturnType<typeof parseJsonGame>;
type JsonFailure = (path: string, reason: string) => never;

function assertDocumentReferences(
  document: JsonDocument,
  patterns: ReturnType<typeof compileJsonPattern>[] | undefined,
  fail: JsonFailure,
): void {
  const resources = new Set(document.resourceIds);
  if (document.board)
    assertBoardReferences(
      document.board,
      [
        ...document.components,
        ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
      ],
      document.phases,
      document.initialPhase,
    );
  if (
    document.board &&
    (document.setup.firstPlayer !== undefined ||
      document.setup.startRound !== undefined)
  )
    fail('setup', 'board owns the starting player and round');
  if (document.victory.kind === 'by-board' && !document.board)
    fail('victory', 'board required');
  for (const [id, action] of Object.entries(document.actions)) {
    if ('recipe' in action && !document.board)
      fail(`actions.${id}`, 'board required');
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
  ) {
    fail('victory.resource', `unknown resource ${document.victory.resource}`);
  }
}

function compileActions(
  document: JsonDocument,
  board: ReturnType<typeof boardTurnRules> | null,
  fail: JsonFailure,
) {
  const actions: Record<
    string,
    DefinedGameAction<Record<string, never>, Record<string, never>>
  > = Object.fromEntries(
    Object.entries(document.actions).map(([id, action]) => [
      id,
      'recipe' in action
        ? action.recipe === 'board-roll'
          ? (board?.roll ?? fail(`actions.${id}`, 'board required'))
          : (board?.draw ?? fail(`actions.${id}`, 'board required'))
        : defineAction<Record<string, never>, Record<string, never>>({
            input: gameInput.object({}),
            execute: ({ ctx }) => ctx.effects.run(...action.effects),
          }),
    ]),
  );
  return actions;
}
