import type { GameContext } from '../game-rule-context';
import { typedRuntimeHandler } from '../actions/parsed-input';
import type {
  GameInputDescriptor,
  GameInputSchema,
} from '../actions/game-input-schema';
import type { StatusScope } from '../kits/player-values-kit';

export type EffectTarget =
  | { kind: 'self' }
  | { kind: 'player'; playerId: number }
  | { kind: 'next' }
  | { kind: 'all-players' }
  | { kind: 'all-opponents' }
  | { kind: 'random-opponent' }
  | {
      kind: 'chosen-opponent';
      choiceId?: string;
      optional?: boolean;
      chooserPlayerId?: number;
    }
  | {
      kind: 'chosen-player';
      playerIds: readonly number[];
      choiceId?: string;
      optional?: boolean;
      chooserPlayerId?: number;
    };

export type EffectCondition =
  | {
      kind: 'has-resource';
      resource: string;
      amount: number;
      target?: EffectTarget;
    }
  | { kind: 'has-status'; status: string; target?: EffectTarget }
  | {
      kind: 'track-position';
      trackId: string;
      position?: number;
      min?: number;
      max?: number;
      target?: EffectTarget;
    }
  | { kind: 'has-card'; handId: string; cardId?: string; target?: EffectTarget }
  | { kind: 'not'; condition: EffectCondition }
  | { kind: 'all'; conditions: readonly EffectCondition[] }
  | { kind: 'any'; conditions: readonly EffectCondition[] };

export type EffectChoiceAvailability =
  | {
      kind: 'cards';
      handId: string;
      owner: EffectTarget;
    }
  | {
      kind: 'resources';
      owner: EffectTarget;
      amount?: number;
    };

export type GameEffectInstruction =
  | {
      kind: 'conditional';
      condition: EffectCondition;
      then: readonly GameEffectInstruction[];
      else?: readonly GameEffectInstruction[];
    }
  | {
      kind: 'reaction';
      choiceId?: string;
      reactor: EffectTarget;
      options: readonly string[];
      availability?: EffectChoiceAvailability;
      reactions: Readonly<Record<string, readonly GameEffectInstruction[]>>;
      fallback?: readonly GameEffectInstruction[];
    }
  | {
      kind: 'choose-player';
      choiceId?: string;
      candidates?: 'opponents' | 'active-players';
    }
  | {
      kind: 'move';
      trackId: string;
      spaces: number;
      target?: EffectTarget;
    }
  | {
      kind: 'move-to';
      trackId: string;
      position: number;
      target?: EffectTarget;
    }
  | {
      kind: 'draw-cards';
      deckId: string;
      handId: string;
      count: number;
      recycle?: boolean;
      target?: EffectTarget;
    }
  | {
      kind: 'discard-random';
      deckId: string;
      handId: string;
      count: number;
      target?: EffectTarget;
    }
  | {
      kind: 'discard-random-inventory';
      inventoryId: string;
      count: number;
      target?: EffectTarget;
    }
  | {
      kind: 'gain-resource';
      resource: string;
      amount: number;
      target?: EffectTarget;
    }
  | {
      kind: 'lose-resource';
      resource: string;
      amount: number;
      allowPartial?: boolean;
      target?: EffectTarget;
    }
  | {
      kind: 'transfer-resource';
      resource: string;
      amount: number;
      from: EffectTarget;
      to: EffectTarget;
    }
  | {
      kind: 'give-card';
      handId: string;
      cardId: string;
      from: EffectTarget;
      to: EffectTarget;
    }
  | {
      kind: 'steal-card';
      handId: string;
      count?: number;
      from: EffectTarget;
      to?: EffectTarget;
    }
  | {
      kind: 'swap-hands';
      handId: string;
      left: EffectTarget;
      right: EffectTarget;
    }
  | {
      kind: 'steal-random-inventory';
      inventoryId: string;
      count?: number;
      from: EffectTarget;
      to?: EffectTarget;
    }
  | {
      kind: 'swap-inventories';
      inventoryId: string;
      left: EffectTarget;
      right: EffectTarget;
    }
  | {
      kind: 'exchange-random-inventory';
      inventoryId: string;
      left: EffectTarget;
      right: EffectTarget;
    }
  | {
      kind: 'gain-score';
      amount: number;
      target?: EffectTarget;
    }
  | { kind: 'skip-turn'; count?: number; target?: EffectTarget }
  | { kind: 'extra-turn'; count?: number }
  | {
      kind: 'add-status';
      status: string;
      turns?: number;
      scope?: StatusScope;
      stack?: boolean;
      data?: Record<string, unknown>;
      target?: EffectTarget;
    }
  | { kind: 'remove-status'; status: string; target?: EffectTarget }
  | { kind: 'roll-dice'; diceId?: string }
  | { kind: 'reverse-turn-order' }
  | {
      kind: 'swap-positions';
      trackId: string;
      left: EffectTarget;
      right: EffectTarget;
    }
  | { kind: 'complete-turn' }
  | {
      kind: 'custom';
      effectId: string;
      /** Opaque persisted payload; parsed by the resolver selected by effectId. */
      data?: unknown;
      target?: EffectTarget;
    };

export type EffectEngineState = {
  /** Schema version of persisted effect continuations. */
  schemaVersion: number;
  queue: GameEffectInstruction[];
  actorPlayerId: number | null;
  chosenPlayerId: number | null;
  awaitingChoiceId: string | null;
  awaitingReaction: {
    choiceId: string;
    reactions: Record<string, GameEffectInstruction[]>;
    fallback: GameEffectInstruction[];
  } | null;
  awaitingPlayerChoice: {
    choiceId: string;
    optional: boolean;
  } | null;
  playerChoiceResolved: boolean;
  resolvedPlayerChoiceId: string | null;
  completeTurnWhenDrained: boolean;
  /** Provenance de la chaîne courante, conservée pendant tout le tour. */
  source?: EffectSource | null;
};

export type EffectSource = {
  playerId: number | null;
  cardId?: string | number;
  deckId?: string;
  tileId?: string | number;
};

export interface GameEffectResolverShape<TState extends object> {
  input: GameInputDescriptor;
  resolveRaw(input: RawGameEffectResolution<TState>): void;
}

export type RawGameEffectResolution<TState extends object> = {
  state: TState;
  actorPlayerId: number | null;
  source: EffectSource | null;
  targetPlayerIds: readonly number[];
  data: unknown;
  ctx: GameContext<TState>;
};

export interface GameEffectResolver<TState extends object, TData> {
  input: GameInputSchema<TData>;
  apply(input: {
    state: TState;
    actorPlayerId: number | null;
    source: EffectSource | null;
    targetPlayerIds: readonly number[];
    data: TData;
    ctx: GameContext<TState>;
  }): void;
}

export type DefinedGameEffectResolver<
  TState extends object,
  TData,
> = GameEffectResolver<TState, TData> & GameEffectResolverShape<TState>;

export function defineEffect<TState extends object, TData>(
  resolver: GameEffectResolver<TState, TData>,
): DefinedGameEffectResolver<TState, TData> {
  const runtimeHandler = typedRuntimeHandler<
    TData,
    Omit<RawGameEffectResolution<TState>, 'data'>
  >({
    schema: resolver.input,
    path: 'effect.data',
    handle: (execution, data) => resolver.apply({ ...execution, data }),
  });
  return Object.freeze({
    ...resolver,
    resolveRaw: ({ data, ...execution }: RawGameEffectResolution<TState>) =>
      runtimeHandler.handle(execution, data),
  });
}

export function createEffectEngineState(): EffectEngineState {
  return {
    schemaVersion: 1,
    queue: [],
    actorPlayerId: null,
    chosenPlayerId: null,
    awaitingChoiceId: null,
    awaitingReaction: null,
    awaitingPlayerChoice: null,
    playerChoiceResolved: false,
    resolvedPlayerChoiceId: null,
    completeTurnWhenDrained: false,
    source: null,
  };
}
