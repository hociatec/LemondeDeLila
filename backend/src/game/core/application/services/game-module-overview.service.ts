import { Inject, Injectable, Optional } from '@nestjs/common';
import { ModuleOverviewDto } from '../contracts/generic-module.model';
import {
  GAME_MODULE_OVERVIEW,
  GameModuleOverviewProvider,
} from '../contracts/game-module-overview.contract';

@Injectable()
export class GameModuleOverviewRegistryService {
  constructor(
    @Optional()
    @Inject(GAME_MODULE_OVERVIEW)
    private readonly providers: GameModuleOverviewProvider[] = [],
  ) {}

  getModules(): ModuleOverviewDto[] {
    const list = Array.isArray(this.providers) ? this.providers : [];
    return list.map((provider) => provider.getOverview());
  }
}
