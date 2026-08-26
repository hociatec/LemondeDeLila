import { Injectable } from '@nestjs/common';

import { GameRegistryService } from '../../../game/public-api';
import { CatalogSourceGame } from '../../application/models/catalog-source-game.record';
import { CatalogGameSourcePort } from '../../application/ports/catalog-game-source.port';

@Injectable()
export class CatalogGameRegistrySource implements CatalogGameSourcePort {
  constructor(private readonly registry: GameRegistryService) {}

  async listGames(): Promise<CatalogSourceGame[]> {
    const definitions = await this.registry.listGames();
    return definitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      minPlayers: definition.minPlayers,
      maxPlayers: definition.maxPlayers,
      chatEnabled: definition.chatEnabled,
      chatSoundsEnabled: definition.chatSoundsEnabled,
      category: definition.category,
      subcategory: definition.subcategory,
      manifestPath: definition.manifestPath,
      rulesPath: definition.rulesPath,
      status: definition.status,
    }));
  }
}
