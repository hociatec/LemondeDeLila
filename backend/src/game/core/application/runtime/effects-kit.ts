import type { GameContext } from './game-rule-context';
import type { GameInputSchema } from './game-input-schema';
import type { StatusScope } from './player-values-kit';

export type EffectTarget =
  | { kind: 'self' }
  | { kind: 'player'; playerId: number }
  | { kind: 'next' }
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
      data?: Record<string, unknown>;
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
  input: GameInputSchema<unknown>;
  apply(input: {
    state: TState;
    actorPlayerId: number | null;
    source: EffectSource | null;
    targetPlayerIds: readonly number[];
    data: unknown;
    ctx: GameContext<TState>;
  }): void;
}

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

export function defineEffect<TState extends object, TData>(
  resolver: GameEffectResolver<TState, TData>,
): GameEffectResolver<TState, TData> {
  return Object.freeze(resolver);
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

const self = (): EffectTarget => ({ kind: 'self' });

export const gameEffects = {
  target: {
    self,
    player: (playerId: number): EffectTarget => ({ kind: 'player', playerId }),
    next: (): EffectTarget => ({ kind: 'next' }),
    allOpponents: (): EffectTarget => ({ kind: 'all-opponents' }),
    randomOpponent: (): EffectTarget => ({ kind: 'random-opponent' }),
    chosenOpponent: (
      choiceId?: string,
      optional = false,
      chooserPlayerId?: number,
    ): EffectTarget => ({
      kind: 'chosen-opponent',
      choiceId,
      optional,
      chooserPlayerId,
    }),
    chosenFrom: (
      playerIds: readonly number[],
      choiceId?: string,
      optional = false,
      chooserPlayerId?: number,
    ): EffectTarget => ({
      kind: 'chosen-player',
      playerIds: [...new Set(playerIds)],
      choiceId,
      optional,
      chooserPlayerId,
    }),
  },
  choosePlayer: (
    options: {
      choiceId?: string;
      candidates?: 'opponents' | 'active-players';
    } = {},
  ): GameEffectInstruction => ({ kind: 'choose-player', ...options }),
  when: (
    condition: EffectCondition,
    then: readonly GameEffectInstruction[],
    otherwise: readonly GameEffectInstruction[] = [],
  ): GameEffectInstruction => ({
    kind: 'conditional',
    condition,
    then: structuredClone(then),
    else: structuredClone(otherwise),
  }),
  condition: {
    hasResource: (
      resource: string,
      amount: number,
      target: EffectTarget = self(),
    ): EffectCondition => ({ kind: 'has-resource', resource, amount, target }),
    hasStatus: (
      status: string,
      target: EffectTarget = self(),
    ): EffectCondition => ({ kind: 'has-status', status, target }),
    atPosition: (
      trackId: string,
      position: number,
      target: EffectTarget = self(),
    ): EffectCondition => ({
      kind: 'track-position',
      trackId,
      position,
      target,
    }),
    hasCard: (
      handId: string,
      cardId?: string,
      target: EffectTarget = self(),
    ): EffectCondition => ({ kind: 'has-card', handId, cardId, target }),
    not: (condition: EffectCondition): EffectCondition => ({
      kind: 'not',
      condition,
    }),
    all: (...conditions: readonly EffectCondition[]): EffectCondition => ({
      kind: 'all',
      conditions: structuredClone(conditions),
    }),
    any: (...conditions: readonly EffectCondition[]): EffectCondition => ({
      kind: 'any',
      conditions: structuredClone(conditions),
    }),
  },
  move: (
    trackId: string,
    spaces: number,
    target: EffectTarget = self(),
  ): GameEffectInstruction => ({ kind: 'move', trackId, spaces, target }),
  moveTo: (
    trackId: string,
    position: number,
    target: EffectTarget = self(),
  ): GameEffectInstruction => ({ kind: 'move-to', trackId, position, target }),
  drawCards: (options: {
    deckId: string;
    handId: string;
    count: number;
    recycle?: boolean;
    target?: EffectTarget;
  }): GameEffectInstruction => ({ kind: 'draw-cards', ...options }),
  discardCards: (options: {
    deckId: string;
    handId: string;
    count: number;
    target?: EffectTarget;
  }): GameEffectInstruction => ({ kind: 'discard-random', ...options }),
  discardInventory: (options: {
    inventoryId: string;
    count: number;
    target?: EffectTarget;
  }): GameEffectInstruction => ({
    kind: 'discard-random-inventory',
    ...options,
  }),
  giveCard: (options: {
    handId: string;
    cardId: string;
    from?: EffectTarget;
    to: EffectTarget;
  }): GameEffectInstruction => ({
    kind: 'give-card',
    ...options,
    from: options.from ?? self(),
  }),
  stealCard: (options: {
    handId: string;
    from: EffectTarget;
    to?: EffectTarget;
    count?: number;
  }): GameEffectInstruction => ({ kind: 'steal-card', ...options }),
  swapHands: (
    handId: string,
    left: EffectTarget,
    right: EffectTarget,
  ): GameEffectInstruction => ({ kind: 'swap-hands', handId, left, right }),
  stealInventory: (options: {
    inventoryId: string;
    from: EffectTarget;
    to?: EffectTarget;
    count?: number;
  }): GameEffectInstruction => ({
    kind: 'steal-random-inventory',
    ...options,
  }),
  swapInventories: (
    inventoryId: string,
    left: EffectTarget,
    right: EffectTarget,
  ): GameEffectInstruction => ({
    kind: 'swap-inventories',
    inventoryId,
    left,
    right,
  }),
  exchangeRandomInventory: (
    inventoryId: string,
    left: EffectTarget,
    right: EffectTarget,
  ): GameEffectInstruction => ({
    kind: 'exchange-random-inventory',
    inventoryId,
    left,
    right,
  }),
  gainResource: (
    resource: string,
    amount: number,
    target: EffectTarget = self(),
  ): GameEffectInstruction => ({
    kind: 'gain-resource',
    resource,
    amount,
    target,
  }),
  loseResource: (
    resource: string,
    amount: number,
    target: EffectTarget = self(),
    options: { allowPartial?: boolean } = {},
  ): GameEffectInstruction => ({
    kind: 'lose-resource',
    resource,
    amount,
    target,
    ...options,
  }),
  gainScore: (
    amount: number,
    target: EffectTarget = self(),
  ): GameEffectInstruction => ({ kind: 'gain-score', amount, target }),
  skipTurn: (
    count = 1,
    target: EffectTarget = self(),
  ): GameEffectInstruction => ({ kind: 'skip-turn', count, target }),
  extraTurn: (count = 1): GameEffectInstruction => ({
    kind: 'extra-turn',
    count,
  }),
  addStatus: (options: {
    status: string;
    turns?: number;
    scope?: StatusScope;
    stack?: boolean;
    data?: Record<string, unknown>;
    target?: EffectTarget;
  }): GameEffectInstruction => ({ kind: 'add-status', ...options }),
  shield: (
    turns = 1,
    target: EffectTarget = self(),
  ): GameEffectInstruction => ({
    kind: 'add-status',
    status: 'shield',
    turns,
    scope: 'turn',
    target,
  }),
  removeStatus: (
    status: string,
    target: EffectTarget = self(),
  ): GameEffectInstruction => ({ kind: 'remove-status', status, target }),
  rollDice: (diceId = 'main'): GameEffectInstruction => ({
    kind: 'roll-dice',
    diceId,
  }),
  reverseTurnOrder: (): GameEffectInstruction => ({
    kind: 'reverse-turn-order',
  }),
  swapPositions: (
    trackId: string,
    left: EffectTarget,
    right: EffectTarget,
  ): GameEffectInstruction => ({
    kind: 'swap-positions',
    trackId,
    left,
    right,
  }),
  completeTurn: (): GameEffectInstruction => ({ kind: 'complete-turn' }),
  custom: (
    effectId: string,
    data: Record<string, unknown> = {},
    target?: EffectTarget,
  ): GameEffectInstruction => ({ kind: 'custom', effectId, data, target }),
  reaction: (options: {
    choiceId?: string;
    reactor: EffectTarget;
    options: readonly string[];
    availability?: EffectChoiceAvailability;
    reactions: Readonly<Record<string, readonly GameEffectInstruction[]>>;
    fallback?: readonly GameEffectInstruction[];
  }): GameEffectInstruction => ({
    kind: 'reaction',
    ...structuredClone(options),
  }),
  chooseOption: (options: {
    choiceId?: string;
    chooser?: EffectTarget;
    options: readonly string[];
    effects: Readonly<Record<string, readonly GameEffectInstruction[]>>;
    fallback?: readonly GameEffectInstruction[];
  }): GameEffectInstruction => ({
    kind: 'reaction',
    choiceId: options.choiceId,
    reactor: options.chooser ?? self(),
    options: structuredClone(options.options),
    reactions: structuredClone(options.effects),
    fallback: structuredClone(options.fallback ?? []),
  }),
  chooseCard: (options: {
    handId: string;
    cardIds: readonly string[];
    owner?: EffectTarget;
    chooser?: EffectTarget;
    choiceId?: string;
    effects: Readonly<Record<string, readonly GameEffectInstruction[]>>;
    fallback?: readonly GameEffectInstruction[];
  }): GameEffectInstruction => ({
    kind: 'reaction',
    choiceId: options.choiceId,
    reactor: options.chooser ?? self(),
    options: structuredClone(options.cardIds),
    availability: {
      kind: 'cards',
      handId: options.handId,
      owner: options.owner ?? self(),
    },
    reactions: structuredClone(options.effects),
    fallback: structuredClone(options.fallback ?? []),
  }),
  chooseResource: (options: {
    resources: readonly string[];
    owner?: EffectTarget;
    chooser?: EffectTarget;
    amount?: number;
    choiceId?: string;
    effects: Readonly<Record<string, readonly GameEffectInstruction[]>>;
    fallback?: readonly GameEffectInstruction[];
  }): GameEffectInstruction => ({
    kind: 'reaction',
    choiceId: options.choiceId,
    reactor: options.chooser ?? self(),
    options: structuredClone(options.resources),
    availability: {
      kind: 'resources',
      owner: options.owner ?? self(),
      amount: options.amount,
    },
    reactions: structuredClone(options.effects),
    fallback: structuredClone(options.fallback ?? []),
  }),
  chooseTile: (options: {
    tileIds: readonly string[];
    chooser?: EffectTarget;
    choiceId?: string;
    effects: Readonly<Record<string, readonly GameEffectInstruction[]>>;
    fallback?: readonly GameEffectInstruction[];
  }): GameEffectInstruction => ({
    kind: 'reaction',
    choiceId: options.choiceId,
    reactor: options.chooser ?? self(),
    options: structuredClone(options.tileIds),
    reactions: structuredClone(options.effects),
    fallback: structuredClone(options.fallback ?? []),
  }),
  sequence: (
    ...effects: readonly GameEffectInstruction[]
  ): GameEffectInstruction[] => [...structuredClone(effects)],
};
