import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { NawakActionService } from './actions/nawak-action.service';
import { NawakBotService } from './bots/nawak-bot.service';
import { NawakChallengeService } from './data/nawak-challenge.service';
import { NawakPresenterService } from './presenter/nawak-presenter.service';
import { NawakSetupService } from './setup/nawak-setup.service';
import { NawakService } from './nawak.service';

@Module({
  imports: [
    BoardGameCoreKitModule,
    GameCoreModule,
    GameRegistryModule,
    ],
  providers: [
    NawakService,
    NawakChallengeService,
    NawakSetupService,
    NawakActionService,
    NawakPresenterService,
    NawakBotService,
  ],
  exports: [NawakService],
})
export class NawakModule {}
