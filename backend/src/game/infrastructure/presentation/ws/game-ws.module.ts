import { Module } from '@nestjs/common';
import { GAME_WS_MODULE_IMPORTS } from './game-ws.module.imports';
import { GAME_WS_CORE_PROVIDERS } from './game-ws.module.providers.core';
import { GAME_WS_PRESENTATION_PROVIDERS } from './game-ws.module.providers.presentation';

@Module({
  imports: GAME_WS_MODULE_IMPORTS,
  providers: [...GAME_WS_CORE_PROVIDERS, ...GAME_WS_PRESENTATION_PROVIDERS],
})
export class GameWsModule {}
