import { Injectable } from '@nestjs/common';

import { CatalogGame } from '../../models/catalog-game.record';
import { ListCatalogGamesService } from './list-catalog-games.service';

@Injectable()
export class GetCatalogGameService {
  constructor(private readonly listGames: ListCatalogGamesService) {}

  async execute(id: string): Promise<CatalogGame | undefined> {
    const games = await this.listGames.execute();
    return games.find((game) => game.id === id);
  }
}
