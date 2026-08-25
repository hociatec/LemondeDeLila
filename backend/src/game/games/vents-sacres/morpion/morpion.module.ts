import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { GridCellActionsService } from '../../../grid/application/services/grid-cell-actions.service';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { GridGameCoreKitModule } from '../../../composition/board-game-kits.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
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




