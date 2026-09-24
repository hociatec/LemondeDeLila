import {
  cards,
  collection,
  inventory,
  movement,
  ownership,
  pawns,
  quiz,
  resources,
} from '../../../engine/sdk/public-api';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import type { Pair } from './primitive-parity-cases';

export const componentCases: Pair<GameComponentDefinition>[] = [
  {
    json: {
      component: 'resource.pool',
      id: 'energy',
      initial: 5,
      min: 0,
      max: 10,
    },
    sdk: resources.pool({ id: 'energy', initial: 5, min: 0, max: 10 }),
  },
  {
    json: {
      component: 'cards.deck',
      id: 'deck',
      cards: ['a', 'b', 'c', 'd', 'e', 'f'],
      shuffle: false,
    },
    sdk: cards.deck({
      id: 'deck',
      cards: ['a', 'b', 'c', 'd', 'e', 'f'],
      shuffle: false,
    }),
  },
  {
    json: {
      component: 'cards.zone',
      id: 'removed',
      deck: 'deck',
      visibility: 'hidden',
    },
    sdk: cards.zone({ id: 'removed', deck: 'deck', visibility: 'hidden' }),
  },
  {
    json: {
      component: 'cards.hands',
      id: 'hand',
      deck: 'deck',
      initial: 1,
      visibility: 'owner',
    },
    sdk: cards.hands({
      id: 'hand',
      deck: 'deck',
      initial: 1,
      visibility: 'owner',
    }),
  },
  {
    json: {
      component: 'cards.sets',
      id: 'sets',
      deck: 'deck',
      hand: 'hand',
      sets: { pair: ['a', 'b'] },
    },
    sdk: cards.sets({
      id: 'sets',
      deck: 'deck',
      hand: 'hand',
      sets: { pair: ['a', 'b'] },
    }),
  },
  {
    json: { component: 'movement.track', id: 'board', spaces: 10 },
    sdk: movement.track({ id: 'board', spaces: 10 }),
  },
  {
    json: { component: 'dice.set', id: 'main', count: 2, sides: 6 },
    sdk: { component: 'dice.set', id: 'main', count: 2, sides: 6 },
  },
  {
    json: { component: 'inventory.set', id: 'bag', items: ['apple', 'pear'] },
    sdk: inventory.set({ id: 'bag', items: ['apple', 'pear'] }),
  },
  {
    json: { component: 'ownership.registry', id: 'land', assets: ['house'] },
    sdk: ownership.registry({ id: 'land', assets: ['house'] }),
  },
  {
    json: {
      component: 'pawn.set',
      id: 'pawns',
      pawns: [{ id: 'red' }, { id: 'blue' }, { id: 'green' }],
      perPlayer: 1,
    },
    sdk: pawns.set({
      id: 'pawns',
      pawns: [{ id: 'red' }, { id: 'blue' }, { id: 'green' }],
      perPlayer: 1,
    }),
  },
  {
    json: {
      component: 'quiz.bank',
      id: 'quiz',
      questions: [
        { id: 'q1', prompt: 'Question', choices: ['A', 'B'], answerIndex: 1 },
      ],
      shuffle: false,
    },
    sdk: quiz.bank({
      id: 'quiz',
      questions: [
        { id: 'q1', prompt: 'Question', choices: ['A', 'B'], answerIndex: 1 },
      ],
      shuffle: false,
    }),
  },
  {
    json: {
      component: 'collection.view',
      id: 'summary',
      groups: {
        points: { kind: 'score' },
        stars: { kind: 'resource', id: 'stars' },
        bag: { kind: 'inventory', id: 'bag' },
      },
      total: 'sum',
    },
    sdk: collection.view({
      id: 'summary',
      groups: {
        points: { kind: 'score' },
        stars: { kind: 'resource', id: 'stars' },
        bag: { kind: 'inventory', id: 'bag' },
      },
      total: 'sum',
    }),
  },
];
