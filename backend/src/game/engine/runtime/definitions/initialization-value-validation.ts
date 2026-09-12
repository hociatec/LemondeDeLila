import type {
  GameInitialization,
  PerPlayerInitialValue,
} from './component-kit';
import type { ValidationFailure } from '../contracts/definition-validation';
import {
  assertGameValue,
  assertPlayerValueId,
} from '../kits/numeric-invariants';

export function assertInitializationValues(
  initialization: GameInitialization | undefined,
  fail: ValidationFailure,
): void {
  if (!initialization) return;
  const check = (path: string, validate: () => void) => {
    try {
      validate();
    } catch {
      fail(path, 'valeur initiale ou identifiant invalide');
    }
  };
  const perPlayer = (value: PerPlayerInitialValue, path: string) => {
    if (typeof value === 'number') {
      check(path, () => assertGameValue(value));
      return;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(path, 'nombre ou table de joueurs requis');
      return;
    }
    for (const [playerId, amount] of Object.entries(value)) {
      if (
        !/^-?[1-9]\d*$/.test(playerId) ||
        !Number.isSafeInteger(Number(playerId))
      )
        fail(`${path}.${playerId}`, 'identifiant de joueur invalide');
      check(`${path}.${playerId}`, () => assertGameValue(amount));
    }
  };
  if (initialization.scores !== undefined)
    perPlayer(initialization.scores, 'initialization.scores');
  for (const [id, value] of Object.entries(initialization.resources ?? {})) {
    const path = `initialization.resources.${id}`;
    check(path, () => assertPlayerValueId(id));
    perPlayer(value, path);
  }
  for (const [id, value] of Object.entries(initialization.counters ?? {})) {
    check(`initialization.counters.${id}`, () => {
      assertPlayerValueId(id);
      assertGameValue(value);
    });
  }
  for (const [id, value] of Object.entries(initialization.tracks ?? {}))
    perPlayer(value, `initialization.tracks.${id}`);
  for (const [index, deal] of (initialization.deals ?? []).entries()) {
    if (!Number.isSafeInteger(deal.count) || deal.count < 1)
      fail(`initialization.deals.${index}.count`, 'quantité invalide');
  }
  for (const [index, placement] of (
    initialization.gridPlacements ?? []
  ).entries()) {
    for (const [positionIndex, position] of placement.positions.entries()) {
      if (
        !Number.isSafeInteger(position.x) ||
        !Number.isSafeInteger(position.y)
      )
        fail(
          `initialization.gridPlacements.${index}.positions.${positionIndex}`,
          'coordonnées invalides',
        );
    }
  }
}
