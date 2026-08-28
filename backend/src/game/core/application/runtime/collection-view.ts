import type { PlayerValuesPlayerView } from './player-values-kit';

export type CollectionValueSource =
  | { readonly kind: 'score' }
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'inventory'; readonly id: string };

export type CollectionViewDefinition = {
  readonly component: 'collection.view';
  readonly id: string;
  readonly groups: Readonly<Record<string, CollectionValueSource>>;
  readonly total?: CollectionValueSource | 'sum';
};

export type CollectionPlayerView = Record<
  string,
  {
    byPlayer: Record<
      string,
      {
        total: number;
        groups: Record<string, { count: number; items?: string[] }>;
      }
    >;
  }
>;

type InventoryPlayerView = Record<
  string,
  {
    visibility: 'owner' | 'public';
    byPlayer: Record<string, string[] | { count: number }>;
  }
>;

export const collection = {
  view(
    definition: Omit<CollectionViewDefinition, 'component'>,
  ): CollectionViewDefinition {
    return Object.freeze({ ...definition, component: 'collection.view' });
  },
};

export function projectCollections(
  definitions: readonly CollectionViewDefinition[],
  playerIds: readonly number[],
  values: PlayerValuesPlayerView,
  inventories: InventoryPlayerView | null,
): CollectionPlayerView {
  return Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      {
        byPlayer: Object.fromEntries(
          playerIds.map((playerId) => {
            const groups = Object.fromEntries(
              Object.entries(definition.groups).map(([groupId, source]) => [
                groupId,
                projectValue(source, playerId, values, inventories),
              ]),
            );
            const total =
              definition.total == null || definition.total === 'sum'
                ? Object.values(groups).reduce(
                    (sum, group) => sum + group.count,
                    0,
                  )
                : projectValue(definition.total, playerId, values, inventories)
                    .count;
            return [String(playerId), { total, groups }];
          }),
        ),
      },
    ]),
  );
}

function projectValue(
  source: CollectionValueSource,
  playerId: number,
  values: PlayerValuesPlayerView,
  inventories: InventoryPlayerView | null,
): { count: number; items?: string[] } {
  if (source.kind === 'score') {
    return { count: values.scoring.byPlayer[String(playerId)] ?? 0 };
  }
  if (source.kind === 'resource') {
    return {
      count: values.resources[source.id]?.[String(playerId)] ?? 0,
    };
  }
  const inventory = inventories?.[source.id]?.byPlayer[String(playerId)];
  if (Array.isArray(inventory)) {
    return { count: inventory.length, items: [...inventory] };
  }
  return { count: inventory?.count ?? 0 };
}
