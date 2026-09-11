import type {
  GameComponentDefinition,
  GameInitialization,
} from '../definitions/component-kit';
import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type { TurnPolicy } from '../kits/turn-kit';
import type { VictoryRule } from './author-rule-contracts';
import type { GameActionMap } from './author-rule-contracts';
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
  readonly initialization?: GameInitialization;
  readonly resourceIds?: readonly string[];
  readonly turn?: TurnPolicy;
  readonly victory?: VictoryRule<TState>;
  readonly actions?: GameActionMap<TState>;
  readonly config?: GameConfigurationShape<TState>;
};
