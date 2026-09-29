import type {
  GameComponentDefinition,
  GameInitialization,
} from '../definitions/component-kit';
import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type { DeclarativeTrigger } from './declarative-trigger';
import type { TurnPolicy } from '../kits/turn-kit';
import type { VictoryRule } from './author-rule-contracts';
import type { GameActionMap } from './author-rule-contracts';
import type { ChoiceResolverShape } from './author-rule-contracts';
import type { PlayerState } from '../../../core/application/models/game-state.model';
import type { GameContext } from '../definitions/game-author-context';
import type { GameEffectResolverShape } from './effect-resolver';
import type { GameConfigurationShape } from '../configuration/configuration-kit';

type PatternComponents = {
  [TKind in GameComponentDefinition['component']]: Extract<
    GameComponentDefinition,
    { component: TKind }
  >;
};

export type GamePattern<
  TState extends object,
  TKind extends GameComponentDefinition['component'] =
    GameComponentDefinition['component'],
  TMechanic extends string = string,
> = {
  readonly id: string;
  readonly mechanics: readonly TMechanic[];
  readonly components?: readonly PatternComponents[TKind][];
  readonly lifecycle?: GameLifecycleHooks<TState>;
  readonly triggers?: readonly DeclarativeTrigger[];
  readonly initialization?: GameInitialization;
  readonly resourceIds?: readonly string[];
  readonly turn?: TurnPolicy;
  readonly victory?: VictoryRule<TState>;
  readonly actions?: GameActionMap<TState>;
  readonly choices?: Readonly<Record<string, ChoiceResolverShape<TState>>>;
  readonly effects?: Readonly<Record<string, GameEffectResolverShape<TState>>>;
  readonly viewExtension?: (input: {
    state: TState;
    actor: PlayerState | null;
    ctx: GameContext<TState>;
  }) => object;
  setup?(input: { players: PlayerState[]; ctx: GameContext<TState> }): object;
  readonly config?: GameConfigurationShape<TState>;
};
