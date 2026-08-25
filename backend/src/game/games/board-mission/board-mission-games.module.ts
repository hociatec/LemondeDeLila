import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../core/infrastructure/module/game-core.module';
import { GameRegistryModule } from '../../engine/infrastructure/module/game-registry.module';
import { EngineServicesModule } from '../../core/infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../core/infrastructure/module/setup-flow.module';
import { BoardGameDeckKitModule } from '../../composition/board-game-kits.module';
import { BoardMissionEngineService } from '../../core/application/services/board-mission/board-mission-engine.service';
import { BoardMissionRuntimeSupportService } from '../../core/application/services/board-mission/board-mission-runtime-support.service';
import { BoardMissionSetupService } from '../../core/application/services/board-mission/board-mission-setup.service';
import { BoardMissionPresenterService } from '../../core/application/services/board-mission/board-mission-presenter.service';
import { BoardMissionBotService } from '../../core/application/services/board-mission/board-mission-bot.service';
import { BoardMissionModelLoaderService } from '../../core/infrastructure/system/board-mission-model-loader.service';
import { BoardMissionRegistrarService } from './infrastructure/registry/board-mission-registrar.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    SetupFlowModule,
  ],
  providers: [
    BoardMissionEngineService,
    BoardMissionRuntimeSupportService,
    BoardMissionSetupService,
    BoardMissionPresenterService,
    BoardMissionBotService,
    BoardMissionModelLoaderService,
    BoardMissionRegistrarService,
  ],
})
export class BoardMissionGamesModule {}




