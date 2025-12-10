import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import * as fs from 'fs';
import { HttpJwtGuard } from '../../../common/guards/http-jwt.guard';
import { GameRegistryService } from '../services/game-registry.service';

@Controller('api/games/:gameType')
@UseGuards(HttpJwtGuard)
export class GameMetadataController {
  constructor(private readonly registry: GameRegistryService) {}

  @Get('rules')
  async getRules(@Param('gameType') gameType: string): Promise<string> {
    const defs = await this.registry.listGames();
    const game = defs.find((g) => g.id === gameType);
    if (game?.rulesPath && fs.existsSync(game.rulesPath)) {
      return fs.promises.readFile(game.rulesPath, 'utf-8');
    }
    return `Règles non disponibles pour ${gameType}.`;
  }
}
