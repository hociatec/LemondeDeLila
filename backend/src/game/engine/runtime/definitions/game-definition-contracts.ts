import type { GameRuleProgram } from '../contracts/game-rule-program';
import type { CompiledGameDefinition } from '../contracts/compiled-game-definition';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameInitialization } from './component-kit';
import type { GameEventDefinition } from '../events/game-event-definition';
import type { GamePattern } from '../contracts/pattern-definition';
export { GAME_DEFINITION_KIND } from '../contracts/compiled-game-definition';
export type {
  CompiledGameDefinition,
  CompiledGameDiagnostics,
} from '../contracts/compiled-game-definition';
export type GameBotDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
> = NonNullable<CompiledGameDefinition<TState, TActions>['bot']>;

/** Typed bindings for game-specific rules kept outside the composition entry. */
export type GameRuleBindings<
  TState extends object,
  TViewExtension extends object = object,
> = Pick<
  CompiledGameDefinition<TState, GameActionMap<TState>, TViewExtension>,
  | 'choices'
  | 'effects'
  | 'automatic'
  | 'lifecycle'
  | 'victory'
  | 'viewExtension'
>;

export interface AuthorGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly GamePattern<TState>[] =
    readonly GamePattern<TState>[],
> extends GameRuleProgram<
  TState,
  TActions,
  TViewExtension,
  TInitialization,
  TEvents
> {
  readonly patterns?: TPatterns;
}

export type GameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly GamePattern<TState>[] =
    readonly GamePattern<TState>[],
> = CompiledGameDefinition<
  TState,
  TActions,
  TViewExtension,
  TInitialization,
  TEvents,
  TPatterns
>;

export type GameDefinitionInput<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly GamePattern<TState>[] =
    readonly GamePattern<TState>[],
> = AuthorGameDefinition<
  TState,
  TActions,
  TViewExtension,
  TInitialization,
  TEvents,
  TPatterns
>;

export type {
  GameActionUiHint,
  GameChoiceUiHint,
  GamePresentation,
  GameActionShape,
  GameActionMap,
  GameActionExecution,
  GameActionDefinition,
  DefinedGameAction,
  GameActionInput,
  GameActionDecision,
  ReservedGameViewKeys,
  GameViewExtension,
  NoGameState,
  ChoiceResolution,
  RawChoiceResolution,
  ChoiceResolverShape,
  ChoiceResolver,
  DefinedChoiceResolver,
  AutomaticRule,
  VictoryRule,
} from '../contracts/author-rule-contracts';

export type {
  DeclarativeState,
  GameSession,
  EngineKitsState,
} from '../state/declarative-state';
