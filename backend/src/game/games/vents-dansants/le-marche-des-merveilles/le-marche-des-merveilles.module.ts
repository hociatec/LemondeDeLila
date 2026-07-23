import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { LeMarcheDesMerveillesActionService } from './actions/le-marche-des-merveilles-action.service';
import { LeMarcheDesMerveillesBotService } from './bots/le-marche-des-merveilles-bot.service';
import { LeMarcheDesMerveillesPresenterService } from './presenter/le-marche-des-merveilles-presenter.service';
import { LeMarcheDesMerveillesService } from './le-marche-des-merveilles.service';
import { LeMarcheDesMerveillesSetupService } from './setup/le-marche-des-merveilles-setup.service';

@Module({
  imports: [BoardGameCoreKitModule, GameCoreModule, GameRegistryModule],
  providers: [
    LeMarcheDesMerveillesService,
    LeMarcheDesMerveillesSetupService,
    LeMarcheDesMerveillesActionService,
    LeMarcheDesMerveillesPresenterService,
    LeMarcheDesMerveillesBotService,
  ],
  exports: [LeMarcheDesMerveillesService],
})
export class LeMarcheDesMerveillesModule {}
