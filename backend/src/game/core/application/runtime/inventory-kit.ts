import {
  GameConfigurationError,
  GameNotFoundError,
  GameRuleViolationError,
  GameStateViolationError,
} from '../../domain/errors/game-domain.errors';
import type { EventVisibility } from '../models/game-event.model';

export type InventoryDefinition = {
  readonly component: 'inventory.set';
  id: string;
  items?: readonly string[];
  visibility?: 'owner' | 'public';
};

export type InventoryKitState = {
  byPlayer: Record<string, Record<string, string[]>>;
};

export function createInventoryKitState(): InventoryKitState {
  return { byPlayer: {} };
}

export const inventory = {
  set(definition: Omit<InventoryDefinition, 'component'>): InventoryDefinition {
    if (
      definition.items?.some((itemId) => !itemId.trim()) ||
      new Set(definition.items ?? []).size !== (definition.items?.length ?? 0)
    ) {
      throw new GameConfigurationError(
        `Catalogue d’inventaire invalide: ${definition.id}`,
      );
    }
    return Object.freeze({
      ...definition,
      component: 'inventory.set',
      items: definition.items ? Object.freeze([...definition.items]) : undefined,
    });
  },
};

export class GameInventoryController {
  constructor(
    private readonly state: InventoryKitState,
    private readonly random: { shuffle<T>(values: readonly T[]): T[] },
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
      visibility?: EventVisibility,
    ) => void = () => {},
    definitions: readonly InventoryDefinition[] = [],
  ) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
    const legacy = this.state as InventoryKitState & {
      definitions?: Record<string, InventoryDefinition>;
    };
    for (const definition of Object.values(legacy.definitions ?? {})) {
      this.definitions.set(definition.id, definition);
    }
    delete legacy.definitions;
  }

  private readonly definitions = new Map<string, InventoryDefinition>();

  create(
    definition: InventoryDefinition,
    playerIds: readonly number[],
  ): void {
    this.definitions.set(definition.id, definition);
    this.state.byPlayer[definition.id] = Object.fromEntries(
      playerIds.map((playerId) => [String(playerId), []]),
    );
  }

  reset(inventoryId: string): void {
    this.definitions.delete(inventoryId);
    delete this.state.byPlayer[inventoryId];
  }

  assertValid(): void {
    for (const [inventoryId, definition] of this.definitions) {
      const inventories = this.state.byPlayer[inventoryId];
      if (!inventories) {
        throw new GameStateViolationError('Inventaire absent', { inventoryId });
      }
      const allowed = definition.items ? new Set(definition.items) : null;
      for (const items of Object.values(inventories)) {
        if (
          !Array.isArray(items) ||
          (allowed && items.some((itemId) => !allowed.has(itemId)))
        ) {
          throw new GameStateViolationError('Contenu d’inventaire invalide', {
            inventoryId,
          });
        }
      }
    }
  }

  items(inventoryId: string, playerId: number): string[] {
    this.requireDefinition(inventoryId);
    const byPlayer = (this.state.byPlayer[inventoryId] ??= {});
    return (byPlayer[String(playerId)] ??= []);
  }

  add(
    inventoryId: string,
    playerId: number,
    itemId: string,
    count = 1,
  ): void {
    this.requireItem(inventoryId, itemId);
    const items = this.items(inventoryId, playerId);
    for (let index = 0; index < Math.max(0, count); index += 1) {
      items.push(itemId);
    }
    if (count > 0) {
      this.emit(
        'inventory.item-added',
        { inventoryId, playerId, itemId, count },
        this.eventVisibility(inventoryId, [playerId]),
      );
    }
  }

  remove(
    inventoryId: string,
    playerId: number,
    itemId: string,
    count = 1,
  ): void {
    const items = this.items(inventoryId, playerId);
    if (this.quantity(inventoryId, playerId, itemId) < count) {
      throw new GameRuleViolationError('INSUFFICIENT_INVENTORY', {
        inventoryId,
        playerId,
        itemId,
        count,
      });
    }
    for (let removed = 0; removed < Math.max(0, count); removed += 1) {
      items.splice(items.indexOf(itemId), 1);
    }
    if (count > 0) {
      this.emit(
        'inventory.item-removed',
        { inventoryId, playerId, itemId, count },
        this.eventVisibility(inventoryId, [playerId]),
      );
    }
  }

  has(inventoryId: string, playerId: number, itemId: string): boolean {
    return this.items(inventoryId, playerId).includes(itemId);
  }

  quantity(inventoryId: string, playerId: number, itemId: string): number {
    return this.items(inventoryId, playerId).filter(
      (candidate) => candidate === itemId,
    ).length;
  }

  count(inventoryId: string, playerId: number): number {
    return this.items(inventoryId, playerId).length;
  }

  counts(inventoryId: string): Record<number, number> {
    const byPlayer = this.state.byPlayer[inventoryId] ?? {};
    return Object.fromEntries(
      Object.entries(byPlayer).map(([playerId, items]) => [
        Number(playerId),
        items.length,
      ]),
    );
  }

  quantities(inventoryId: string, playerId: number): Record<string, number> {
    return this.items(inventoryId, playerId).reduce<Record<string, number>>(
      (quantities, itemId) => {
        quantities[itemId] = (quantities[itemId] ?? 0) + 1;
        return quantities;
      },
      {},
    );
  }

  transfer(
    inventoryId: string,
    fromPlayerId: number,
    toPlayerId: number,
    itemId: string,
    count = 1,
  ): void {
    this.remove(inventoryId, fromPlayerId, itemId, count);
    this.add(inventoryId, toPlayerId, itemId, count);
    this.emit(
      'inventory.transferred',
      { inventoryId, fromPlayerId, toPlayerId, itemId, count },
      this.eventVisibility(inventoryId, [fromPlayerId, toPlayerId]),
    );
  }

  exchange(
    inventoryId: string,
    leftPlayerId: number,
    leftItemId: string,
    rightPlayerId: number,
    rightItemId: string,
  ): void {
    if (!this.has(inventoryId, leftPlayerId, leftItemId)) {
      throw new GameRuleViolationError('INSUFFICIENT_INVENTORY', {
        inventoryId,
        playerId: leftPlayerId,
        itemId: leftItemId,
      });
    }
    if (!this.has(inventoryId, rightPlayerId, rightItemId)) {
      throw new GameRuleViolationError('INSUFFICIENT_INVENTORY', {
        inventoryId,
        playerId: rightPlayerId,
        itemId: rightItemId,
      });
    }
    this.remove(inventoryId, leftPlayerId, leftItemId);
    this.remove(inventoryId, rightPlayerId, rightItemId);
    this.add(inventoryId, leftPlayerId, rightItemId);
    this.add(inventoryId, rightPlayerId, leftItemId);
    this.emit(
      'inventory.exchanged',
      { inventoryId, leftPlayerId, rightPlayerId },
      this.eventVisibility(inventoryId, [leftPlayerId, rightPlayerId]),
    );
  }

  swap(inventoryId: string, leftPlayerId: number, rightPlayerId: number): void {
    const byPlayer = (this.state.byPlayer[inventoryId] ??= {});
    const left = byPlayer[String(leftPlayerId)] ?? [];
    const right = byPlayer[String(rightPlayerId)] ?? [];
    byPlayer[String(leftPlayerId)] = right;
    byPlayer[String(rightPlayerId)] = left;
    this.emit(
      'inventory.swapped',
      { inventoryId, leftPlayerId, rightPlayerId },
      this.eventVisibility(inventoryId, [leftPlayerId, rightPlayerId]),
    );
  }

  stealRandom(
    inventoryId: string,
    fromPlayerId: number,
    toPlayerId: number,
  ): string | null {
    const itemId = this.random.shuffle(
      this.items(inventoryId, fromPlayerId),
    )[0];
    if (!itemId) return null;
    this.transfer(inventoryId, fromPlayerId, toPlayerId, itemId);
    return itemId;
  }

  removeRandom(inventoryId: string, playerId: number): string | null {
    const itemId = this.random.shuffle(this.items(inventoryId, playerId))[0];
    if (!itemId) return null;
    this.remove(inventoryId, playerId, itemId);
    return itemId;
  }

  private eventVisibility(
    inventoryId: string,
    playerIds: readonly number[],
  ): EventVisibility {
    return this.requireDefinition(inventoryId).visibility === 'owner'
      ? { kind: 'private', playerIds: [...new Set(playerIds)] }
      : { kind: 'public' };
  }

  private requireDefinition(inventoryId: string): InventoryDefinition {
    const definition = this.definitions.get(inventoryId);
    if (!definition) {
      throw new GameNotFoundError(`Inventaire inconnu: ${inventoryId}`);
    }
    return definition;
  }

  private requireItem(inventoryId: string, itemId: string): void {
    const definition = this.requireDefinition(inventoryId);
    if (definition.items && !definition.items.includes(itemId)) {
      throw new GameNotFoundError(`Objet d’inventaire inconnu: ${itemId}`);
    }
  }
}

export function projectInventoryKitState(
  state: InventoryKitState,
  viewerPlayerId: number | null,
  definitions: readonly InventoryDefinition[] = [],
): Record<
  string,
  {
    visibility: 'owner' | 'public';
    byPlayer: Record<string, string[] | { count: number }>;
  }
> {
  return Object.fromEntries(
    Object.entries(state.byPlayer).map(([inventoryId, byPlayer]) => {
      const visibility =
        definitions.find((definition) => definition.id === inventoryId)
          ?.visibility ?? 'public';
      return [
        inventoryId,
        {
          visibility,
          byPlayer: Object.fromEntries(
            Object.entries(byPlayer).map(([playerId, items]) => [
              playerId,
              visibility === 'public' || Number(playerId) === viewerPlayerId
                ? [...items]
                : { count: items.length },
            ]),
          ),
        },
      ];
    }),
  );
}
