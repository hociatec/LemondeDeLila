import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { GerardPresidentActionService } from './actions/gerard-president-action.service';
import { GerardPresidentBotService } from './bots/gerard-president-bot.service';
import { GerardPresidentPresenterService } from './presenter/gerard-president-presenter.service';
import { GerardPresidentSetupService } from './setup/gerard-president-setup.service';
import { GerardPresidentService } from './gerard-president.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule, GameRegistryModule],
  providers: [
    GerardPresidentService,
    GerardPresidentSetupService,
    GerardPresidentActionService,
    GerardPresidentPresenterService,
    GerardPresidentBotService,
  ],
  exports: [GerardPresidentService],
})
export class GerardPresidentModule {}
