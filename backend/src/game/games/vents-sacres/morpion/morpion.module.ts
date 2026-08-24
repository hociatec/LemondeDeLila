import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreService } from '../../../application/services/game-core.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { GridCellActionsService } from '../../../application/features/grid/services/grid-cell-actions.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { GridGameCoreKitModule } from '../../../module/board-game-kits.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
import { MorpionPresenter } from './application/services/morpion.presenter';
import { MorpionService } from './application/services/morpion.service';

@Module({
  imports: [
    ConfigModule,
    GameCoreModule,
    GridGameCoreKitModule,
    SetupFlowModule,
  ],
  providers: [
    {
      provide: MorpionPresenter,
      inject: [GridCellActionsService],
      useFactory: (gridCellActions: GridCellActionsService) =>
        new MorpionPresenter(gridCellActions),
    },
    {
      provide: MorpionService,
      inject: [MorpionPresenter, GameCoreService, SetupFlowService],
      useFactory: (
        presenter: MorpionPresenter,
        core: GameCoreService,
        setupFlow: SetupFlowService,
      ) => new MorpionService(presenter, core, setupFlow),
    },
  ],
  exports: [MorpionService],
})
export class MorpionModule {}




