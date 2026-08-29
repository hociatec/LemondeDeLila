import type {
  EffectChoiceAvailability,
  EffectCondition,
  EffectTarget,
  GameEffectInstruction,
} from './effects-core';
import type { StatusScope } from './player-values-kit';

const self = (): EffectTarget => ({ kind: 'self' });

/** A named local composition expanded without registering another effect kind. */
export function defineEffectRecipe<TArgs extends readonly unknown[]>(
  compose: (...args: TArgs) => readonly GameEffectInstruction[],
): (...args: TArgs) => readonly GameEffectInstruction[] {
  return (...args) => Object.freeze(structuredClone(compose(...args)));
}

export const gameEffects = {
  target: {
    self,
    player: (playerId: number): EffectTarget => ({ kind: 'player', playerId }),
    next: (): EffectTarget => ({ kind: 'next' }),
    allPlayers: (): EffectTarget => ({ kind: 'all-players' }),
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
