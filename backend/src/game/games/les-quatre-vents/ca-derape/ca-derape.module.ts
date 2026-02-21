import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { CaDerapeService } from './ca-derape.service';
import { CaSetupService } from './setup/ca.setup';
import { CaActionService } from './actions/ca-actions.service';
import { CaPresenterService } from './presenter/ca-presenter.service';
import { CaBotService } from './bots/ca-bot.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule, GameRegistryModule],
  providers: [
    CaDerapeService,
    CaSetupService,
    CaActionService,
    CaPresenterService,
    CaBotService,
  ],
  exports: [CaDerapeService],
})
export class CaDerapeModule {}
