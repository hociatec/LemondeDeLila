import type { AuthorSchema } from './json-author-schema';
import type { GameRuleProgram } from './game-rule-program';
import type { GameActionMap } from './author-rule-contracts';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { JsonGameCoreDocument } from '../definitions/json-game-core-document';
import type { GamePattern } from './pattern-definition';

type JsonState = Record<string, never>;
type JsonActions = GameActionMap<JsonState>;
export type JsonGameViewExtension = {
  progress?: Readonly<Record<number, unknown>>;
  currentChallengeId?: string;
  lastRound?: unknown;
  currentTheme?: string | null;
  secondTheme?: string | null;
  buildings?: Readonly<Record<number, unknown>>;
};

export type JsonExtensionHandlers = Partial<
  Pick<
    GameRuleProgram<JsonState, JsonActions, JsonGameViewExtension>,
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

export type JsonExtensionHandlerContext = Readonly<{
  recipeBot: (recipe: string) => NonNullable<JsonExtensionHandlers['bot']>;
  boardBot: () => NonNullable<JsonExtensionHandlers['bot']>;
  publicStatuses: () => NonNullable<
    JsonExtensionHandlers['playerValuesVisibility']
  >;
  actionFor: (
    availableActions: readonly string[],
    recipes: readonly string[],
  ) => string | undefined;
}>;

export type JsonExtensionValidationContext = Readonly<{
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

export type JsonProgramExtensionDefinition<
  DocumentKey extends string,
  Program,
  OutputKey extends string,
  Compiled,
> = Readonly<{
  documentKey: DocumentKey;
  outputKey: OutputKey;
  schema: AuthorSchema;
  compile: (program: Program) => Compiled;
  compileUnknown: (program: unknown) => Compiled;
  actions?: (compiled: Compiled) => Readonly<Record<string, unknown>>;
  collectActions: (compiled: unknown) => Readonly<Record<string, unknown>>;
  events?: (compiled: Compiled) => readonly unknown[];
  collectEvents: (compiled: unknown) => readonly unknown[];
  components?: (compiled: Compiled) => readonly unknown[];
  collectComponents: (compiled: unknown) => readonly unknown[];
  handlers?: (
    context: JsonExtensionHandlerContext,
    compiled: Compiled,
    program: Program,
  ) => JsonExtensionHandlers;
  collectHandlers: (
    context: JsonExtensionHandlerContext,
    compiled: unknown,
    program: unknown,
  ) => JsonExtensionHandlers;
  victoryKind?: string;
  victoryLabel?: string;
  ownsSetup?: boolean;
  validate?: (
    context: JsonExtensionValidationContext,
    program: Program,
  ) => void;
  validateUnknown: (
    context: JsonExtensionValidationContext,
    program: unknown,
  ) => void;
  choiceIds?: (program: Program) => readonly (string | undefined)[];
  collectChoiceIds: (program: unknown) => readonly (string | undefined)[];
  patterns?: (compiled: Compiled) => readonly unknown[];
  collectPatterns: (compiled: unknown) => readonly unknown[];
}>;

export function defineJsonProgramExtension<
  const DocumentKey extends string,
  Program,
  const OutputKey extends string,
  Compiled,
>(
  definition: Omit<
    JsonProgramExtensionDefinition<DocumentKey, Program, OutputKey, Compiled>,
    | 'compileUnknown'
    | 'collectActions'
    | 'collectEvents'
    | 'collectComponents'
    | 'collectHandlers'
    | 'validateUnknown'
    | 'collectChoiceIds'
    | 'collectPatterns'
  >,
): JsonProgramExtensionDefinition<DocumentKey, Program, OutputKey, Compiled> {
  return Object.freeze({
    ...definition,
    compileUnknown: (program: unknown) =>
      definition.compile(program as Program),
    collectActions: (compiled: unknown) =>
      definition.actions?.(compiled as Compiled) ?? {},
    collectEvents: (compiled: unknown) =>
      definition.events?.(compiled as Compiled) ?? [],
    collectComponents: (compiled: unknown) =>
      definition.components?.(compiled as Compiled) ?? [],
    collectHandlers: (
      context: JsonExtensionHandlerContext,
      compiled: unknown,
      program: unknown,
    ) =>
      definition.handlers?.(
        context,
        compiled as Compiled,
        program as Program,
      ) ?? {},
    validateUnknown: (
      context: JsonExtensionValidationContext,
      program: unknown,
    ) => definition.validate?.(context, program as Program),
    collectChoiceIds: (program: unknown) =>
      definition.choiceIds?.(program as Program) ?? [],
    collectPatterns: (compiled: unknown) =>
      definition.patterns?.(compiled as Compiled) ?? [],
  });
}
