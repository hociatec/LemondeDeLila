import { Injectable } from '@nestjs/common';
import { GAMEPLAY_MECHANICS_CATALOG } from '../../../../engine/runtime/definitions/mechanics-catalog';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRegistryService } from '../../../application/services/game-registry.service';

@Injectable()
export class GameWsCatalogPresenter {
  constructor(
    private readonly overviewRegistry: GameModuleOverviewRegistryService,
    private readonly registry: GameRegistryService,
  ) {}

  present() {
    return {
      modules: this.overviewRegistry.getModules(),
      games: this.registry.listDescriptors(),
      sdk: GAMEPLAY_MECHANICS_CATALOG,
    };
  }
}
