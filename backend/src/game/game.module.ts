import { Module } from '@nestjs/common';
import { GAME_MODULE_IMPORTS } from './module/game.module.definition';

@Module({
  imports: GAME_MODULE_IMPORTS,
  exports: GAME_MODULE_IMPORTS,
})
export class GameModule {}
