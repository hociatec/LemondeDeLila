import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { CardsKitState } from './cards-contracts';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(path: string): never {
  throw new GameStateViolationError('État de cartes invalide', { path });
}

/** Validate containers before normalization reads or rewrites any card. */
export function assertCardStateShape(state: CardsKitState): void {
  for (const key of [
    'decks',
    'discards',
    'deckLifecycles',
    'hands',
    'zones',
    'completedSets',
  ] as const) {
    if (!record(state[key])) fail(key);
  }
  for (const key of ['decks', 'discards', 'zones'] as const) {
    for (const [id, values] of Object.entries(state[key])) {
      if (!Array.isArray(values)) fail(`${key}.${id}`);
    }
  }
  for (const [id, lifecycle] of Object.entries(state.deckLifecycles)) {
    if (
      !Object.hasOwn(state.decks, id) ||
      !record(lifecycle) ||
      !['exhaust', 'recycle'].includes(lifecycle.empty) ||
      typeof lifecycle.exhausted !== 'boolean'
    )
      fail(`deckLifecycles.${id}`);
  }
  for (const id of Object.keys(state.discards)) {
    if (!Object.hasOwn(state.decks, id)) fail(`discards.${id}`);
  }
  for (const id of Object.keys(state.decks)) {
    if (!Object.hasOwn(state.discards, id)) fail(`discards.${id}`);
    if (!Object.hasOwn(state.deckLifecycles, id)) fail(`deckLifecycles.${id}`);
  }
  for (const key of ['hands', 'completedSets'] as const) {
    for (const [id, players] of Object.entries(state[key])) {
      if (!record(players)) fail(`${key}.${id}`);
      for (const [playerId, values] of Object.entries(players)) {
        if (
          !/^-?[1-9]\d*$/.test(playerId) ||
          !Number.isSafeInteger(Number(playerId)) ||
          !Array.isArray(values)
        )
          fail(`${key}.${id}.${playerId}`);
        if (
          key === 'completedSets' &&
          (values.some((value) => typeof value !== 'string') ||
            new Set(values).size !== values.length)
        )
          fail(`${key}.${id}.${playerId}`);
      }
    }
  }
}
