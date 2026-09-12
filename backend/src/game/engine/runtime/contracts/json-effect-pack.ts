/** Generic, domain-owned contribution to the closed JSON engine. */
import type { AuthorSchema } from './json-author-schema';
import type { GameRuleProgram } from './game-rule-program';
import type { GameActionMap } from './author-rule-contracts';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { JsonGameCoreDocument } from '../definitions/json-game-core-document';
import type { GamePattern } from './pattern-definition';

type JsonState = Record<string, never>;
type JsonActions = GameActionMap<JsonState>;
export type JsonGameViewAugmentation = {
  progress?: Readonly<Record<number, unknown>>;
  currentChallengeId?: string;
  lastRound?: unknown;
  currentTheme?: string | null;
  secondTheme?: string | null;
  buildings?: Readonly<Record<number, unknown>>;
};

export type JsonEffectPackHandlers = Partial<
  Pick<
    GameRuleProgram<JsonState, JsonActions, JsonGameViewAugmentation>,
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

export type JsonEffectPackHandlerContext = Readonly<{
  recipeBot: (recipe: string) => NonNullable<JsonEffectPackHandlers['bot']>;
  boardBot: () => NonNullable<JsonEffectPackHandlers['bot']>;
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

export type JsonEffectPackDefinition<
  DocumentKey extends string,
  Program,
  OutputKey extends string,
  Compiled,
> = Readonly<{
  scope: 'generic';
  domain: 'board' | 'cards' | 'choice' | 'collection' | 'race' | 'spatial';
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
    context: JsonEffectPackHandlerContext,
    compiled: Compiled,
    program: Program,
  ) => JsonEffectPackHandlers;
  collectHandlers: (
    context: JsonEffectPackHandlerContext,
    compiled: unknown,
    program: unknown,
  ) => JsonEffectPackHandlers;
  victoryKind?: string;
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
  patterns?: (compiled: Compiled) => readonly unknown[];
  collectPatterns: (compiled: unknown) => readonly unknown[];
}>;

export function defineJsonEffectPack<
  const DocumentKey extends string,
  Program,
  const OutputKey extends string,
  Compiled,
>(
  definition: Omit<
    JsonEffectPackDefinition<DocumentKey, Program, OutputKey, Compiled>,
    | 'compileUnknown'
    | 'collectActions'
    | 'collectEvents'
    | 'collectComponents'
    | 'collectHandlers'
    | 'validateUnknown'
    | 'collectChoiceIds'
    | 'collectPatterns'
  >,
): JsonEffectPackDefinition<DocumentKey, Program, OutputKey, Compiled> {
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
      context: JsonEffectPackHandlerContext,
      compiled: unknown,
      program: unknown,
    ) =>
      definition.handlers?.(
        context,
        compiled as Compiled,
        program as Program,
      ) ?? {},
    validateUnknown: (
      context: JsonEffectPackValidationContext,
      program: unknown,
    ) => definition.validate?.(context, program as Program),
    collectChoiceIds: (program: unknown) =>
      definition.choiceIds?.(program as Program) ?? [],
    collectPatterns: (compiled: unknown) =>
      definition.patterns?.(compiled as Compiled) ?? [],
  });
}
