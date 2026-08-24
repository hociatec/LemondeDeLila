import { EngineModule } from '../module/engine.module';
import { GamePluginsModule } from './game-plugins.module';

export const GAME_MODULE_IMPORTS = [EngineModule, GamePluginsModule.forRoot()];

