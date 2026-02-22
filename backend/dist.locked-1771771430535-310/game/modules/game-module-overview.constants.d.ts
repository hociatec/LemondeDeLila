import { ModuleOverviewDto } from './dto/generic-module.dto';
export declare const GAME_MODULE_OVERVIEW: unique symbol;
export interface GameModuleOverviewProvider {
    getOverview(): ModuleOverviewDto;
}
