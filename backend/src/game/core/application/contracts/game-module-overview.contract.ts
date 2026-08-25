import { ModuleOverviewDto } from '../models/generic-module.model';

export const GAME_MODULE_OVERVIEW = Symbol('GAME_MODULE_OVERVIEW');

export interface GameModuleOverviewProvider {
  getOverview(): ModuleOverviewDto;
}
