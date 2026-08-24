import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { GridBlockedEdgesService } from '../../../application/features/grid/services/grid-blocked-edges.service';
import { GridCellActionsService } from '../../../application/features/grid/services/grid-cell-actions.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { GridGameBotKitModule } from '../../../module/board-game-kits.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
import { CorridorService } from './application/services/corridor.service';
import { CorridorSetupService } from './application/services/corridor-setup.service';
import { CorridorActionService } from './application/services/corridor-action.service';
import { CorridorPresenterService } from './application/services/corridor-presenter.service';
import { CorridorBotService } from './application/services/corridor-bot.service';

@Module({
  imports: [
    ConfigModule,
    GameCoreModule,
    GridGameBotKitModule,
    SetupFlowModule,
  ],
  providers: [
    RandomService,
    {
      provide: CorridorSetupService,
      inject: [SetupFlowService, GameCoreService],
      useFactory: (setupFlow: SetupFlowService, core: GameCoreService) =>
        new CorridorSetupService(setupFlow, core),
    },
    {
      provide: CorridorActionService,
      inject: [CorridorSetupService, SetupFlowService],
      useFactory: (
        setup: CorridorSetupService,
        setupFlow: SetupFlowService,
      ) => new CorridorActionService(setup, setupFlow),
    },
    {
      provide: CorridorPresenterService,
      inject: [GridBlockedEdgesService, GridCellActionsService],
      useFactory: (
        gridBlockedEdges: GridBlockedEdgesService,
        gridCellActions: GridCellActionsService,
      ) => new CorridorPresenterService(gridBlockedEdges, gridCellActions),
    },
    {
      provide: CorridorBotService,
      inject: [BotRunnerService, RandomService],
      useFactory: (botRunner: BotRunnerService, random: RandomService) =>
        new CorridorBotService(botRunner, random),
    },
    {
      provide: CorridorService,
      inject: [
        CorridorSetupService,
        CorridorActionService,
        CorridorPresenterService,
        CorridorBotService,
      ],
      useFactory: (
        setup: CorridorSetupService,
        actions: CorridorActionService,
        presenter: CorridorPresenterService,
        bots: CorridorBotService,
      ) => new CorridorService(setup, actions, presenter, bots),
    },
  ],
  exports: [CorridorService],
})
export class CorridorModule {}




