import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';

@Injectable()
export class GameContentService {
  constructor(private readonly registry: GameRegistryService) {}

  async getRules(gameType: string): Promise<string> {
    const defs = await this.registry.listGames();
    const game = defs.find((g) => g.id === gameType);
    if (game?.rulesPath && fs.existsSync(game.rulesPath)) {
      try {
        return await fs.promises.readFile(game.rulesPath, 'utf-8');
      } catch {
        /* ignore */
      }
    }
    return `Règles non disponibles pour ${gameType}.`;
  }
}
