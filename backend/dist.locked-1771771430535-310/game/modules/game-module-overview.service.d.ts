import { ModuleOverviewDto } from './dto/generic-module.dto';
import { GameModuleOverviewProvider } from './game-module-overview.constants';
export declare class GameModuleOverviewRegistryService {
    private readonly providers;
    constructor(providers?: GameModuleOverviewProvider[]);
    getModules(): ModuleOverviewDto[];
}
