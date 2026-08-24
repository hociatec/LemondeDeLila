import type {
  PrimalisMetadata,
  PrimalisResources,
} from '../../model/primalis-state.model';

export type PrimalisFace =
  | 'herbivore'
  | 'carnivore'
  | 'egg'
  | 'leaf'
  | 'danger'
  | 'relance';

export function asPrimalisPartialMeta(
  value: unknown,
): Partial<PrimalisMetadata> {
  return value != null && typeof value === 'object'
    ? (value as Partial<PrimalisMetadata>)
    : {};
}

export function mapPrimalisFace(value: number): PrimalisFace {
  switch (value) {
    case 1:
      return 'herbivore';
    case 2:
      return 'carnivore';
    case 3:
      return 'egg';
    case 4:
      return 'leaf';
    case 5:
      return 'danger';
    case 6:
      return 'relance';
    default:
      return 'herbivore';
  }
}

export function getPrimalisResources(
  meta: PrimalisMetadata,
  playerId: number,
): PrimalisResources {
  const resources = meta.collections?.[playerId];
  return resources ?? { herbivores: 0, carnivores: 0, eggs: 0, leaves: 0 };
}

export function determinePrimalisDuplicate(
  resources: PrimalisResources,
): Partial<PrimalisResources> {
  if (resources.herbivores >= resources.carnivores) {
    return { herbivores: 1 };
  }
  return { carnivores: 1 };
}

export function computePrimalisScore(resources: PrimalisResources): number {
  return resources.herbivores + resources.carnivores + resources.leaves;
}
