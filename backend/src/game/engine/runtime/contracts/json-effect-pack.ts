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
export type JsonEffectPackScope =
  'game-specific' | 'reusable' | 'engine-primitive';
export type JsonEffectPackDomain =
  'board' | 'cards' | 'choice' | 'collection' | 'race' | 'spatial';
type JsonActions = GameActionMap<JsonState>;
export type JsonEffectPackHandlers<View extends object = object> = Partial<
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

export type JsonEffectPackCapability =
  | keyof JsonEffectPackHandlers
  | 'actions'
  | 'events'
  | 'components'
  | 'patterns';

export type JsonRecipeBotSelector = (
  input: Parameters<
    NonNullable<NonNullable<JsonEffectPackHandlers['bot']>['choose']>
  >[0],
) => { recipe: string; payload: Record<string, unknown> } | null;

export type JsonEffectPackHandlerContext = Readonly<{
  selectedBot: (
    select: JsonRecipeBotSelector,
  ) => NonNullable<JsonEffectPackHandlers['bot']>;
  recipeBot: (
    recipe: string | readonly string[],
  ) => NonNullable<JsonEffectPackHandlers['bot']>;
  fallbackRecipeBot: (
    preferred: string,
  ) => NonNullable<JsonEffectPackHandlers['bot']>;
  publicStatuses: () => NonNullable<
    JsonEffectPackHandlers['playerValuesVisibility']
  >;
  actionFor: (
    availableActions: readonly string[],
    recipes: readonly string[],
  ) => string | undefined;
}>;

export type JsonEffectPackValidationContext = Readonly<{
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

/** Compiled values stay inside their pack; the runtime sees only typed contributions. */
export type JsonEffectPackContribution<View extends object = object> =
  Readonly<{
    actions: JsonActions;
    events: readonly GameEventDefinition<string, object>[];
    components: readonly GameComponentDefinition[];
    patterns: readonly GamePattern<JsonState>[];
    handlers: (
      context: JsonEffectPackHandlerContext,
    ) => JsonEffectPackHandlers<View>;
  }>;

export type JsonEffectPackDefinition<
  DocumentKey extends string,
  Program,
  OutputKey extends string,
  Compiled,
  View extends object = object,
> = Readonly<{
  scope: JsonEffectPackScope;
  capabilities: readonly JsonEffectPackCapability[];
  domain: JsonEffectPackDomain;
  documentKey: DocumentKey;
  outputKey: OutputKey;
  schema: AuthorSchema;
  compile: (program: Program) => Compiled;
  /** Validate internal references before factories construct components. */
  validateProgram?: (program: Program) => void;
  compileContribution: (program: unknown) => JsonEffectPackContribution<View>;
  actions?: (compiled: Compiled) => JsonActions;
  events?: (
    compiled: Compiled,
  ) => readonly GameEventDefinition<string, object>[];
  components?: (compiled: Compiled) => readonly GameComponentDefinition[];
  handlers?: (
    context: JsonEffectPackHandlerContext,
    compiled: Compiled,
    program: Program,
  ) => JsonEffectPackHandlers<View>;
  victoryKind?: string;
  /** Defaults to true; opt-out packs must validate their alternative victory modes. */
  victoryRequired?: boolean;
  victoryLabel?: string;
  ownsSetup?: boolean;
  validate?: (
    context: JsonEffectPackValidationContext,
    program: Program,
  ) => void;
  validateUnknown: (
    context: JsonEffectPackValidationContext,
    program: unknown,
  ) => void;
  choiceIds?: (program: Program) => readonly (string | undefined)[];
  collectChoiceIds: (program: unknown) => readonly (string | undefined)[];
  patterns?: (compiled: Compiled) => readonly GamePattern<JsonState>[];
}>;

export function defineJsonEffectPack<
  const DocumentKey extends string,
  Program,
  const OutputKey extends string,
  Compiled,
  View extends object = object,
>(
  definition: Omit<
    JsonEffectPackDefinition<DocumentKey, Program, OutputKey, Compiled, View>,
    'compileContribution' | 'validateUnknown' | 'collectChoiceIds'
  >,
): JsonEffectPackDefinition<DocumentKey, Program, OutputKey, Compiled, View> {
  const codec = createAuthorCodec<Program>(definition.schema);
  const capabilities = Object.freeze([...definition.capabilities]);
  const announced = new Set(capabilities);
  const supported: readonly JsonEffectPackCapability[] = [
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
    ): JsonEffectPackContribution<View> => {
      const program = codec.parse(source, definition.documentKey);
      definition.validateProgram?.(program);
      const compiled = definition.compile(program);
      return Object.freeze({
        actions: definition.actions?.(compiled) ?? {},
        events: definition.events?.(compiled) ?? [],
        components: definition.components?.(compiled) ?? [],
        patterns: definition.patterns?.(compiled) ?? [],
        handlers: (context: JsonEffectPackHandlerContext) => {
          const handlers =
            definition.handlers?.(context, compiled, program) ?? {};
          assertAnnounced(handlers);
          return handlers;
        },
      });
    },
    validateUnknown: (
      context: JsonEffectPackValidationContext,
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
