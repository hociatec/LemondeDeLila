import { Inject, Injectable, Optional } from '@nestjs/common';
import { ModuleOverviewDto } from './dto/generic-module.dto';
import {
  GAME_MODULE_OVERVIEW,
  GameModuleOverviewProvider,
} from './game-module-overview.constants';

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
