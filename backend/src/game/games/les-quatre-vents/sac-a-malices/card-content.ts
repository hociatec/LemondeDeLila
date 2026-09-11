import { gameInput, rejectContent } from '../../../engine/sdk/public-api';
import type { SacCard } from './content-types';
export type { SacCard, SacMovement } from './content-types';

export function parseSacCard(value: unknown): SacCard {
  try {
    return cardSchema.parse(value);
  } catch {
    return rejectContent('Carte structurée Sac à Malices invalide');
  }
}
export const movementInput = gameInput.union([
  gameInput.object({
    kind: gameInput.literal('delta'),
    delta: gameInput.number({ integer: true }),
  }),
  gameInput.object({
    kind: gameInput.enum([
      'last',
      'next-station',
      'next-community',
      'previous-chance',
    ] as const),
  }),
  gameInput.object({
    kind: gameInput.literal('start'),
    collect: gameInput.boolean(),
  }),
  gameInput.object({
    kind: gameInput.literal('next-group'),
    groupId: gameInput.string({ min: 1, max: 128 }),
  }),
  gameInput.object({
    kind: gameInput.literal('tile'),
    tileId: gameInput.string({ min: 1, max: 128 }),
    direction: gameInput.enum(['forward', 'backward'] as const),
  }),
]);

const selfTarget = gameInput.optional(
  gameInput.object({ kind: gameInput.literal('self') }),
);
const instructionSchema = gameInput.union([
  gameInput.object({
    kind: gameInput.literal('custom'),
    effectId: gameInput.literal('sac.lose-infrastructure'),
    data: gameInput.object({}),
  }),
  gameInput.object({
    kind: gameInput.literal('custom'),
    effectId: gameInput.enum(['sac.money', 'sac.everyone-money']),
    data: gameInput.object({ delta: gameInput.number({ integer: true }) }),
  }),
  gameInput.object({
    kind: gameInput.literal('custom'),
    effectId: gameInput.literal('sac.movement'),
    data: gameInput.object({ movement: movementInput }),
  }),
  gameInput.object({
    kind: gameInput.literal('gain-resource'),
    resource: gameInput.literal('sac.jail-cards'),
    amount: gameInput.number({ integer: true, min: 1 }),
    target: selfTarget,
  }),
  gameInput.object({
    kind: gameInput.enum(['skip-turn', 'extra-turn']),
    count: gameInput.number({ integer: true, min: 1 }),
    target: selfTarget,
  }),
]);
const cardSchema = gameInput.object({
  id: gameInput.string({ min: 1, max: 128 }),
  text: gameInput.string({ min: 1 }),
  retained: gameInput.boolean(),
  effects: gameInput.array(instructionSchema),
});
