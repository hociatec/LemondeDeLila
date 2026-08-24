import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../module/game-core.module';
import { GameRegistryModule } from '../../module/game-registry.module';
import { EngineServicesModule } from '../../infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../application/modules/setup-flow.module';
import { BoardGameDeckKitModule } from '../../module/board-game-kits.module';
import { BoardMissionEngineService } from '../../application/services/board-mission/board-mission-engine.service';
import { BoardMissionRuntimeSupportService } from '../../application/services/board-mission/board-mission-runtime-support.service';
import { BoardMissionSetupService } from '../../application/services/board-mission/board-mission-setup.service';
import { BoardMissionPresenterService } from '../../application/services/board-mission/board-mission-presenter.service';
import { BoardMissionBotService } from '../../application/services/board-mission/board-mission-bot.service';
import { BoardMissionModelLoaderService } from '../../infrastructure/system/board-mission-model-loader.service';
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




