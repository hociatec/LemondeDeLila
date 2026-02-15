import { ModuleOverviewDto } from './dto/generic-module.dto';

export const GAME_MODULE_OVERVIEW = Symbol('GAME_MODULE_OVERVIEW');

export interface GameModuleOverviewProvider {
  getOverview(): ModuleOverviewDto;
}
