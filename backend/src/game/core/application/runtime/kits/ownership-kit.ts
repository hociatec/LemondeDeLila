import {
  GameConfigurationError,
  GameNotFoundError,
  GameRuleViolationError,
  GameStateViolationError,
} from '../../../domain/errors/game-domain.errors';
import type { EventVisibility } from '../../models/game-event.model';

export type OwnershipDefinition = {
  readonly component: 'ownership.registry';
  id: string;
  assets: readonly string[];
  exclusive?: boolean;
  visibility?: 'public' | 'owner';
};

export type OwnershipKitState = {
  owners: Record<string, Record<string, number[]>>;
};

export function createOwnershipKitState(): OwnershipKitState {
  return { owners: {} };
}

export const ownership = {
  registry(
    definition: Omit<OwnershipDefinition, 'component'>,
  ): OwnershipDefinition {
    if (
      definition.id.trim().length === 0 ||
      definition.assets.some((assetId) => assetId.trim().length === 0) ||
      new Set(definition.assets).size !== definition.assets.length
    ) {
      throw new GameConfigurationError(
        `Catalogue de propriété invalide: ${definition.id}`,
      );
    }
    return Object.freeze({
      ...definition,
      component: 'ownership.registry',
      assets: Object.freeze([...definition.assets]),
    });
  },
};

export class GameOwnershipController {
  constructor(
    private readonly state: OwnershipKitState,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
      visibility?: EventVisibility,
    ) => void = () => {},
    definitions: readonly OwnershipDefinition[] = [],
  ) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
    const legacy = this.state as OwnershipKitState & {
      definitions?: Record<string, OwnershipDefinition>;
    };
    for (const definition of Object.values(legacy.definitions ?? {})) {
      this.definitions.set(definition.id, definition);
    }
    delete legacy.definitions;
  }

  private readonly definitions = new Map<string, OwnershipDefinition>();

  create(definition: OwnershipDefinition): void {
    this.definitions.set(definition.id, definition);
    this.state.owners[definition.id] = {};
  }

  reset(registryId: string): void {
    this.definitions.delete(registryId);
    delete this.state.owners[registryId];
  }

  assertValid(): void {
    for (const [registryId, definition] of this.definitions) {
      const owners = this.state.owners[registryId];
      if (!owners) {
        throw new GameStateViolationError('Registre de propriété absent', {
          registryId,
        });
      }
      const assets = new Set(definition.assets);
      for (const [assetId, playerIds] of Object.entries(owners)) {
        if (
          !assets.has(assetId) ||
          new Set(playerIds).size !== playerIds.length ||
          ((definition.exclusive ?? true) && playerIds.length > 1)
        ) {
          throw new GameStateViolationError('Propriété invalide', {
            registryId,
            assetId,
          });
        }
      }
    }
  }

  ownersOf(registryId: string, assetId: string): number[] {
    this.requireAsset(registryId, assetId);
    return [...(this.state.owners[registryId]?.[assetId] ?? [])];
  }

  ownerOf(registryId: string, assetId: string): number | null {
    return this.ownersOf(registryId, assetId)[0] ?? null;
  }

  isOwned(registryId: string, assetId: string): boolean {
    return this.ownersOf(registryId, assetId).length > 0;
  }

  isOwner(registryId: string, assetId: string, playerId: number): boolean {
    return this.ownersOf(registryId, assetId).includes(playerId);
  }

  claim(registryId: string, assetId: string, playerId: number): void {
    const definition = this.requireAsset(registryId, assetId);
    const owners = (this.state.owners[registryId][assetId] ??= []);
    if (owners.includes(playerId)) return;
    if ((definition.exclusive ?? true) && owners.length > 0) {
      throw new GameRuleViolationError('ASSET_ALREADY_OWNED', {
        registryId,
        assetId,
        playerId,
      });
    }
    owners.push(playerId);
    this.emit(
      'ownership.claimed',
      { registryId, assetId, playerId },
      this.eventVisibility(registryId, [playerId]),
    );
  }

  release(registryId: string, assetId: string, playerId?: number): void {
    this.requireAsset(registryId, assetId);
    const owners = this.state.owners[registryId]?.[assetId] ?? [];
    const released =
      playerId == null
        ? [...owners]
        : owners.filter((owner) => owner === playerId);
    if (released.length === 0) return;
    if (playerId == null) delete this.state.owners[registryId][assetId];
    else {
      this.state.owners[registryId][assetId] = owners.filter(
        (owner) => owner !== playerId,
      );
    }
    for (const owner of released) {
      this.emit(
        'ownership.released',
        { registryId, assetId, playerId: owner },
        this.eventVisibility(registryId, [owner]),
      );
    }
  }

  transfer(
    registryId: string,
    assetId: string,
    fromPlayerId: number,
    toPlayerId: number,
  ): void {
    if (!this.isOwner(registryId, assetId, fromPlayerId)) {
      throw new GameRuleViolationError('ASSET_NOT_OWNED', {
        registryId,
        assetId,
        playerId: fromPlayerId,
      });
    }
    this.release(registryId, assetId, fromPlayerId);
    this.claim(registryId, assetId, toPlayerId);
    this.emit(
      'ownership.transferred',
      { registryId, assetId, fromPlayerId, toPlayerId },
      this.eventVisibility(registryId, [fromPlayerId, toPlayerId]),
    );
  }

  assetsOf(registryId: string, playerId: number): string[] {
    this.requireRegistry(registryId);
    return Object.entries(this.state.owners[registryId] ?? {})
      .filter(([, owners]) => owners.includes(playerId))
      .map(([assetId]) => assetId);
  }

  releaseAll(registryId: string, playerId: number): string[] {
    const assets = this.assetsOf(registryId, playerId);
    for (const assetId of assets) this.release(registryId, assetId, playerId);
    return assets;
  }

  private eventVisibility(
    registryId: string,
    playerIds: readonly number[],
  ): EventVisibility {
    return this.requireRegistry(registryId).visibility === 'owner'
      ? { kind: 'private', playerIds: [...new Set(playerIds)] }
      : { kind: 'public' };
  }

  private requireRegistry(registryId: string): OwnershipDefinition {
    const definition = this.definitions.get(registryId);
    if (!definition) {
      throw new GameNotFoundError(
        `Registre de propriété inconnu: ${registryId}`,
      );
    }
    return definition;
  }

  private requireAsset(
    registryId: string,
    assetId: string,
  ): OwnershipDefinition {
    const definition = this.requireRegistry(registryId);
    if (!definition.assets.includes(assetId)) {
      throw new GameNotFoundError(`Bien inconnu: ${registryId}/${assetId}`);
    }
    return definition;
  }
}

export function projectOwnershipKitState(
  state: OwnershipKitState,
  viewerPlayerId: number | null,
  definitions: readonly OwnershipDefinition[] = [],
): Record<string, { owners: Record<string, number[]> }> {
  return Object.fromEntries(
    Object.entries(state.owners).map(([registryId, owners]) => {
      const definition = definitions.find(
        (candidate) => candidate.id === registryId,
      );
      return [
        registryId,
        {
          owners: Object.fromEntries(
            Object.entries(owners).flatMap(([assetId, playerIds]) => {
              if (
                definition?.visibility !== 'owner' ||
                (viewerPlayerId != null && playerIds.includes(viewerPlayerId))
              ) {
                return [[assetId, [...playerIds]]];
              }
              return [];
            }),
          ),
        },
      ];
    }),
  );
}
