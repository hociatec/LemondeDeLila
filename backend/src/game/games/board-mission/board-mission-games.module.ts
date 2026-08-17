import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../core/core.module';
import { GameRegistryModule } from '../../engine/game-registry.module';
import { EngineServicesModule } from '../../engine/services/engine-services.module';
import { SetupFlowModule } from '../../modules/setup-flow/setup-flow.module';
import { BoardGameDeckKitModule } from '../../modules/game-kits/board-game-kits.module';
import { BoardMissionEngineService } from '../../engine/board-mission/board-mission-engine.service';
import { BoardMissionRuntimeSupportService } from '../../engine/board-mission/board-mission-runtime-support.service';
import { BoardMissionSetupService } from '../../engine/board-mission/board-mission-setup.service';
import { BoardMissionPresenterService } from '../../engine/board-mission/board-mission-presenter.service';
import { BoardMissionBotService } from '../../engine/board-mission/board-mission-bot.service';
import { BoardMissionModelLoaderService } from '../../engine/board-mission/board-mission-model-loader.service';
import { BoardMissionRegistrarService } from './board-mission-registrar.service';

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
