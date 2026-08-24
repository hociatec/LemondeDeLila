import { Inject, Injectable, Optional } from '@nestjs/common';
import { GameCatalogOverridesService } from '../../engine/application/services/game-catalog-overrides.service';
import {
  GAME_CATALOG_READER,
  type GameCatalogReader,
} from '../ports/game-catalog.reader';

@Injectable()
export class GameContentService {
  constructor(
    @Inject(GAME_CATALOG_READER)
    private readonly catalogReader: GameCatalogReader,
    @Optional()
    private readonly overrides?: GameCatalogOverridesService,
  ) {}

  async getRules(gameType: string): Promise<string> {
    const overrideRules = this.overrides?.getGameOverride(gameType)?.rules;
    if (typeof overrideRules === 'string' && overrideRules.trim().length > 0) {
      return overrideRules;
    }

    for (const entry of this.catalogReader.listEntries()) {
      if (String(entry.manifest.code ?? '').trim() !== gameType) {
        continue;
      }

      if (entry.rulesPath) {
        return this.catalogReader.readTextFile(entry.rulesPath);
      }

      return String(entry.manifest.summary ?? '').trim();
    }

    return '';
  }
}
