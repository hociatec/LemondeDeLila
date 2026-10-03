import type { GameEventDefinition } from '../events/game-event-definition';
import { createAuthorCodec } from './json-author-codec';
/** Domain-owned contribution; reusability must be demonstrated, not assumed. */
import type { AuthorSchema } from './json-author-schema';
import type { GameRuleProgram } from './game-rule-program';
import type { GameActionMap } from './author-rule-contracts';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { JsonGameCoreDocument } from '../definitions/json-game-core-document';
import type { GamePattern } from './pattern-definition';
import { AuthoringError } from './authoring-error';

type JsonState = Record<string, never>;
export type JsonEngineExtensionDomain =
  'board' | 'cards' | 'choice' | 'collection' | 'race' | 'spatial';
type JsonActions = GameActionMap<JsonState>;
export type JsonEngineExtensionHandlers<View extends object = object> = Partial<
  Pick<
    GameRuleProgram<JsonState, JsonActions, View>,
    | 'setup'
    | 'choices'
    | 'effects'
    | 'automatic'
    | 'lifecycle'
    | 'victory'
    | 'viewExtension'
    | 'config'
    | 'initialization'
    | 'resourceIds'
    | 'playerValuesVisibility'
    | 'bot'
  >
>;

export type JsonEngineExtensionCapability =
  | keyof JsonEngineExtensionHandlers
  | 'actions'
  | 'events'
  | 'components'
  | 'patterns';

export type JsonRecipeBotSelector = (
  input: Parameters<
    NonNullable<NonNullable<JsonEngineExtensionHandlers['bot']>['choose']>
  >[0],
) => { recipe: string; payload: Record<string, unknown> } | null;

export type JsonEngineExtensionHandlerContext = Readonly<{
  selectedBot: (
    select: JsonRecipeBotSelector,
  ) => NonNullable<JsonEngineExtensionHandlers['bot']>;
  recipeBot: (
    recipe: string | readonly string[],
  ) => NonNullable<JsonEngineExtensionHandlers['bot']>;
  fallbackRecipeBot: (
    preferred: string,
  ) => NonNullable<JsonEngineExtensionHandlers['bot']>;
  publicStatuses: () => NonNullable<
    JsonEngineExtensionHandlers['playerValuesVisibility']
  >;
  actionFor: (
    availableActions: readonly string[],
    recipes: readonly string[],
  ) => string | undefined;
}>;

export type JsonEngineExtensionValidationContext = Readonly<{
  document: JsonGameCoreDocument;
  patterns: readonly GamePattern<JsonState>[];
  components: readonly GameComponentDefinition[];
  resources: ReadonlySet<string>;
  counters: ReadonlySet<string>;
  minimumPlayers: number;
  maximumPlayers: number;
  gameId: string;
  fail: (path: string, reason: string) => never;
  hasRaceTrack: (trackId: string, winOnFinish?: boolean) => boolean;
}>;

/** Compiled values stay inside their extension; the runtime sees only typed contributions. */
export type JsonEngineExtensionContribution<View extends object = object> =
  Readonly<{
    actions: JsonActions;
    events: readonly GameEventDefinition<string, object>[];
    components: readonly GameComponentDefinition[];
    patterns: readonly GamePattern<JsonState>[];
    handlers: (
      context: JsonEngineExtensionHandlerContext,
    ) => JsonEngineExtensionHandlers<View>;
  }>;

export type JsonEngineExtensionDefinition<
  DocumentKey extends string,
  Program,
  OutputKey extends string,
  Compiled,
  View extends object = object,
> = Readonly<{
  capabilities: readonly JsonEngineExtensionCapability[];
  domain: JsonEngineExtensionDomain;
  documentKey: DocumentKey;
  outputKey: OutputKey;
  schema: AuthorSchema;
  compile: (program: Program) => Compiled;
  /** Validate internal references before factories construct components. */
  validateProgram?: (program: Program) => void;
  compileContribution: (
    program: unknown,
  ) => JsonEngineExtensionContribution<View>;
  actions?: (compiled: Compiled) => JsonActions;
  events?: (
    compiled: Compiled,
  ) => readonly GameEventDefinition<string, object>[];
  components?: (compiled: Compiled) => readonly GameComponentDefinition[];
  handlers?: (
    context: JsonEngineExtensionHandlerContext,
    compiled: Compiled,
    program: Program,
  ) => JsonEngineExtensionHandlers<View>;
  victoryKind?: string;
  /** Defaults to true; opt-out extensions must validate their alternative victory modes. */
  victoryRequired?: boolean;
  victoryLabel?: string;
  ownsSetup?: boolean;
  validate?: (
    context: JsonEngineExtensionValidationContext,
    program: Program,
  ) => void;
  validateUnknown: (
    context: JsonEngineExtensionValidationContext,
    program: unknown,
  ) => void;
  choiceIds?: (program: Program) => readonly (string | undefined)[];
  collectChoiceIds: (program: unknown) => readonly (string | undefined)[];
  patterns?: (compiled: Compiled) => readonly GamePattern<JsonState>[];
}>;

export function defineJsonEngineExtension<
  const DocumentKey extends string,
  Program,
  const OutputKey extends string,
  Compiled,
  View extends object = object,
>(
  definition: Omit<
    JsonEngineExtensionDefinition<
      DocumentKey,
      Program,
      OutputKey,
      Compiled,
      View
    >,
    'compileContribution' | 'validateUnknown' | 'collectChoiceIds'
  >,
): JsonEngineExtensionDefinition<
  DocumentKey,
  Program,
  OutputKey,
  Compiled,
  View
> {
  const codec = createAuthorCodec<Program>(definition.schema);
  const capabilities = Object.freeze([...definition.capabilities]);
  const announced = new Set(capabilities);
  const supported: readonly JsonEngineExtensionCapability[] = [
    'actions',
    'events',
    'components',
    'patterns',
    'setup',
    'choices',
    'effects',
    'automatic',
    'lifecycle',
    'victory',
    'viewExtension',
    'config',
    'initialization',
    'resourceIds',
    'playerValuesVisibility',
    'bot',
  ];
  for (const capability of capabilities)
    if (!supported.includes(capability))
      throw new AuthoringError(
        `${definition.documentKey}.capabilities`,
        'supported capability name',
        capability,
      );
  if (announced.size !== capabilities.length)
    throw new AuthoringError(
      `${definition.documentKey}.capabilities`,
      'unique capability names',
      capabilities,
    );
  const assertAnnounced = (contributions: object) => {
    for (const [key, value] of Object.entries(contributions)) {
      if (
        value !== undefined &&
        !capabilities.some((capability) => capability === key)
      )
        throw new AuthoringError(
          `${definition.documentKey}.capabilities.${key}`,
          'declared extension capability',
          key,
        );
    }
  };
  assertAnnounced({
    actions: definition.actions,
    events: definition.events,
    components: definition.components,
    patterns: definition.patterns,
  });
  return Object.freeze({
    ...definition,
    capabilities,
    schema: codec.schema,
    compileContribution: (
      source: unknown,
    ): JsonEngineExtensionContribution<View> => {
      const program = codec.parse(source, definition.documentKey);
      definition.validateProgram?.(program);
      const compiled = definition.compile(program);
      return Object.freeze({
        actions: definition.actions?.(compiled) ?? {},
        events: definition.events?.(compiled) ?? [],
        components: definition.components?.(compiled) ?? [],
        patterns: definition.patterns?.(compiled) ?? [],
        handlers: (context: JsonEngineExtensionHandlerContext) => {
          const handlers =
            definition.handlers?.(context, compiled, program) ?? {};
          assertAnnounced(handlers);
          return handlers;
        },
      });
    },
    validateUnknown: (
      context: JsonEngineExtensionValidationContext,
      program: unknown,
    ) =>
      definition.validate?.(
        context,
        codec.parse(program, definition.documentKey),
      ),
    collectChoiceIds: (program: unknown) =>
      definition.choiceIds?.(codec.parse(program, definition.documentKey)) ??
      [],
  });
}
