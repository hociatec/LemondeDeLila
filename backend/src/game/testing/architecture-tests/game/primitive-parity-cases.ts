import { gameEffects as effects } from '../../../engine/sdk/public-api';
import type {
  GameEffectInstruction,
  EffectCondition,
  EffectTarget,
} from '../../../engine/runtime/contracts/effect-ir';

export type Pair<Value> = { json: Value; sdk: Value };
const self: EffectTarget = { kind: 'self' };
const other: EffectTarget = { kind: 'player', playerId: 2 };
const reward: GameEffectInstruction[] = [{ kind: 'gain-score', amount: 3 }];

// Record exhaustiveness makes adding a primitive without a parity case a type error.
export const primitiveCases = {
  'move-card': {
    json: {
      kind: 'move-card',
      source: { kind: 'hand', handId: 'hand', playerId: 1 },
      destination: { kind: 'zone', zoneId: 'removed' },
      cardId: 'a',
    },
    sdk: effects.moveCard({
      source: { kind: 'hand', handId: 'hand', playerId: 1 },
      destination: { kind: 'zone', zoneId: 'removed' },
      cardId: 'a',
    }),
  },
  custom: {
    json: { kind: 'custom', effectId: 'parity.add', data: { amount: 4 } },
    sdk: effects.custom('parity.add', { amount: 4 }),
  },
  move: {
    json: { kind: 'move', trackId: 'board', spaces: -3 },
    sdk: effects.move('board', -3),
  },
  'move-to': {
    json: { kind: 'move-to', trackId: 'board', position: 7 },
    sdk: effects.moveTo('board', 7),
  },
  'draw-cards': {
    json: { kind: 'draw-cards', deckId: 'deck', handId: 'hand', count: 2 },
    sdk: effects.drawCards({ deckId: 'deck', handId: 'hand', count: 2 }),
  },
  'discard-random': {
    json: { kind: 'discard-random', deckId: 'deck', handId: 'hand', count: 1 },
    sdk: effects.discardCards({ deckId: 'deck', handId: 'hand', count: 1 }),
  },
  'discard-random-inventory': {
    json: { kind: 'discard-random-inventory', inventoryId: 'bag', count: 1 },
    sdk: effects.discardInventory({ inventoryId: 'bag', count: 1 }),
  },
  'gain-resource': {
    json: { kind: 'gain-resource', resource: 'stars', amount: 4 },
    sdk: effects.gainResource('stars', 4),
  },
  'lose-resource': {
    json: {
      kind: 'lose-resource',
      resource: 'stars',
      amount: 40,
      allowPartial: true,
    },
    sdk: effects.loseResource('stars', 40, self, { allowPartial: true }),
  },
  'transfer-resource': {
    json: {
      kind: 'transfer-resource',
      resource: 'stars',
      amount: 2,
      from: self,
      to: other,
    },
    sdk: {
      kind: 'transfer-resource',
      resource: 'stars',
      amount: 2,
      from: self,
      to: other,
    },
  },
  'exchange-resources': {
    json: {
      kind: 'exchange-resources',
      left: self,
      right: other,
      leftOffer: { resource: 'stars', amount: 3 },
      rightOffer: { resource: 'coins', amount: 2 },
    },
    sdk: {
      kind: 'exchange-resources',
      left: self,
      right: other,
      leftOffer: { resource: 'stars', amount: 3 },
      rightOffer: { resource: 'coins', amount: 2 },
    },
  },
  'give-card': {
    json: {
      kind: 'give-card',
      handId: 'hand',
      cardId: 'a',
      from: self,
      to: other,
    },
    sdk: effects.giveCard({ handId: 'hand', cardId: 'a', to: other }),
  },
  'steal-card': {
    json: { kind: 'steal-card', handId: 'hand', from: other },
    sdk: effects.stealCard({ handId: 'hand', from: other }),
  },
  'swap-hands': {
    json: { kind: 'swap-hands', handId: 'hand', left: self, right: other },
    sdk: effects.swapHands('hand', self, other),
  },
  'exchange-random-cards': {
    json: {
      kind: 'exchange-random-cards',
      handId: 'hand',
      left: self,
      right: other,
    },
    sdk: effects.exchangeRandomCards('hand', self, other),
  },
  'steal-random-inventory': {
    json: { kind: 'steal-random-inventory', inventoryId: 'bag', from: other },
    sdk: effects.stealInventory({ inventoryId: 'bag', from: other }),
  },
  'swap-inventories': {
    json: {
      kind: 'swap-inventories',
      inventoryId: 'bag',
      left: self,
      right: other,
    },
    sdk: effects.swapInventories('bag', self, other),
  },
  'exchange-random-inventory': {
    json: {
      kind: 'exchange-random-inventory',
      inventoryId: 'bag',
      left: self,
      right: other,
    },
    sdk: effects.exchangeRandomInventory('bag', self, other),
  },
  'gain-score': {
    json: { kind: 'gain-score', amount: 4 },
    sdk: effects.gainScore(4),
  },
  'skip-turn': {
    json: { kind: 'skip-turn', target: other, count: 2 },
    sdk: effects.skipTurn(2, other),
  },
  'extra-turn': {
    json: { kind: 'extra-turn', count: 2 },
    sdk: effects.extraTurn(2),
  },
  'add-status': {
    json: { kind: 'add-status', status: 'shield', turns: 3, stack: true },
    sdk: effects.addStatus({ status: 'shield', turns: 3, stack: true }),
  },
  'remove-status': {
    json: { kind: 'remove-status', status: 'shield' },
    sdk: effects.removeStatus('shield'),
  },
  'roll-dice': {
    json: { kind: 'roll-dice', diceId: 'main' },
    sdk: effects.rollDice(),
  },
  'reverse-turn-order': {
    json: { kind: 'reverse-turn-order' },
    sdk: effects.reverseTurnOrder(),
  },
  'swap-positions': {
    json: {
      kind: 'swap-positions',
      trackId: 'board',
      left: self,
      right: other,
    },
    sdk: effects.swapPositions('board', self, other),
  },
  'complete-turn': {
    json: { kind: 'complete-turn' },
    sdk: effects.completeTurn(),
  },
  'start-round': {
    json: { kind: 'start-round' },
    sdk: { kind: 'start-round' },
  },
  'end-round': { json: { kind: 'end-round' }, sdk: { kind: 'end-round' } },
  'eliminate-player': {
    json: { kind: 'eliminate-player', target: other },
    sdk: { kind: 'eliminate-player', target: other },
  },
  conditional: {
    json: {
      kind: 'conditional',
      condition: { kind: 'has-status', status: 'shield' },
      then: reward,
      else: [],
    },
    sdk: effects.when(effects.condition.hasStatus('shield'), reward),
  },
  reaction: {
    json: {
      kind: 'reaction',
      choiceId: 'select',
      reactor: self,
      options: ['yes', 'no'],
      reactions: { yes: reward, no: [] },
    },
    sdk: effects.reaction({
      choiceId: 'select',
      reactor: self,
      options: ['yes', 'no'],
      reactions: { yes: reward, no: [] },
    }),
  },
  'choose-player': {
    json: { kind: 'choose-player', choiceId: 'select' },
    sdk: effects.choosePlayer({ choiceId: 'select' }),
  },
} satisfies Record<GameEffectInstruction['kind'], Pair<GameEffectInstruction>>;

export const conditionCases = {
  'phase-is': {
    json: { kind: 'phase-is', phase: 'playing' },
    sdk: { kind: 'phase-is', phase: 'playing' },
  },
  'compare-values': {
    json: {
      kind: 'compare-values',
      left: { kind: 'resource-value', resource: 'stars' },
      compare: 'gte',
      right: 2,
    },
    sdk: {
      kind: 'compare-values',
      left: { kind: 'resource-value', resource: 'stars' },
      compare: 'gte',
      right: 2,
    },
  },
  score: {
    json: { kind: 'score', compare: 'gt', amount: 1 },
    sdk: { kind: 'score', compare: 'gt', amount: 1 },
  },
  resource: {
    json: { kind: 'resource', resource: 'stars', compare: 'gte', amount: 10 },
    sdk: { kind: 'resource', resource: 'stars', compare: 'gte', amount: 10 },
  },
  'inventory-count': {
    json: {
      kind: 'inventory-count',
      inventoryId: 'bag',
      itemId: 'apple',
      compare: 'eq',
      amount: 2,
    },
    sdk: {
      kind: 'inventory-count',
      inventoryId: 'bag',
      itemId: 'apple',
      compare: 'eq',
      amount: 2,
    },
  },
  'owns-asset': {
    json: { kind: 'owns-asset', registryId: 'land', assetId: 'house' },
    sdk: { kind: 'owns-asset', registryId: 'land', assetId: 'house' },
  },
  'has-resource': {
    json: { kind: 'has-resource', resource: 'stars', amount: 5 },
    sdk: effects.condition.hasResource('stars', 5),
  },
  'has-status': {
    json: { kind: 'has-status', status: 'shield' },
    sdk: effects.condition.hasStatus('shield'),
  },
  'track-position': {
    json: { kind: 'track-position', trackId: 'board', position: 2 },
    sdk: effects.condition.atPosition('board', 2),
  },
  'has-card': {
    json: { kind: 'has-card', handId: 'hand', cardId: 'a' },
    sdk: effects.condition.hasCard('hand', 'a'),
  },
  not: {
    json: { kind: 'not', condition: { kind: 'has-status', status: 'missing' } },
    sdk: effects.condition.not(effects.condition.hasStatus('missing')),
  },
  all: {
    json: {
      kind: 'all',
      conditions: [
        { kind: 'has-status', status: 'shield' },
        { kind: 'has-resource', resource: 'stars', amount: 5 },
      ],
    },
    sdk: effects.condition.all(
      effects.condition.hasStatus('shield'),
      effects.condition.hasResource('stars', 5),
    ),
  },
  any: {
    json: {
      kind: 'any',
      conditions: [
        { kind: 'has-status', status: 'missing' },
        { kind: 'has-resource', resource: 'stars', amount: 5 },
      ],
    },
    sdk: effects.condition.any(
      effects.condition.hasStatus('missing'),
      effects.condition.hasResource('stars', 5),
    ),
  },
} satisfies Record<EffectCondition['kind'], Pair<EffectCondition>>;

export const targetCases = {
  'current-player': {
    json: { kind: 'current-player' },
    sdk: effects.target.current(),
  },
  'matching-players': {
    json: {
      kind: 'matching-players',
      participants: 'all',
      condition: { kind: 'owns-asset', registryId: 'land', assetId: 'house' },
    },
    sdk: effects.target.owners('land', 'house'),
  },
  self: { json: { kind: 'self' }, sdk: effects.target.self() },
  player: {
    json: { kind: 'player', playerId: 2 },
    sdk: effects.target.player(2),
  },
  next: { json: { kind: 'next' }, sdk: effects.target.next() },
  previous: { json: { kind: 'previous' }, sdk: effects.target.previous() },
  'random-player': {
    json: { kind: 'random-player' },
    sdk: effects.target.randomPlayer(),
  },
  leader: {
    json: { kind: 'leader', ties: 'all' },
    sdk: effects.target.leader('all'),
  },
  last: {
    json: { kind: 'last', ties: 'random' },
    sdk: effects.target.last('random'),
  },
  'all-players': {
    json: { kind: 'all-players' },
    sdk: effects.target.allPlayers(),
  },
  'all-opponents': {
    json: { kind: 'all-opponents' },
    sdk: effects.target.allOpponents(),
  },
  'random-opponent': {
    json: { kind: 'random-opponent' },
    sdk: effects.target.randomOpponent(),
  },
  'chosen-opponent': {
    json: { kind: 'chosen-opponent', choiceId: 'select', optional: false },
    sdk: effects.target.chosenOpponent('select'),
  },
  'chosen-player': {
    json: {
      kind: 'chosen-player',
      playerIds: [1, 2],
      choiceId: 'select',
      optional: false,
    },
    sdk: effects.target.chosenFrom([1, 2], 'select'),
  },
} satisfies Record<EffectTarget['kind'], Pair<EffectTarget>>;

export const choiceAvailabilityCases: Record<
  string,
  Pair<GameEffectInstruction>
> = {
  cards: {
    json: {
      kind: 'reaction',
      choiceId: 'select',
      reactor: self,
      options: ['a', 'b'],
      availability: { kind: 'cards', handId: 'hand', owner: self },
      reactions: { a: reward },
      fallback: [],
    },
    sdk: effects.chooseCard({
      choiceId: 'select',
      handId: 'hand',
      cardIds: ['a', 'b'],
      effects: { a: reward },
    }),
  },
  resources: {
    json: {
      kind: 'reaction',
      choiceId: 'select',
      reactor: self,
      options: ['stars', 'coins'],
      availability: { kind: 'resources', owner: self, amount: 8 },
      reactions: { stars: reward },
      fallback: [],
    },
    sdk: effects.chooseResource({
      choiceId: 'select',
      resources: ['stars', 'coins'],
      amount: 8,
      effects: { stars: reward },
    }),
  },
};
