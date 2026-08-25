import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { BoardGameCoreKitModule } from '../../../composition/board-game-kits.module';
import { LeMarcheDesMerveillesActionService } from './application/services/le-marche-des-merveilles-action.service';
import { LeMarcheDesMerveillesBotService } from './application/services/le-marche-des-merveilles-bot.service';
import { LeMarcheDesMerveillesPresenterService } from './application/services/le-marche-des-merveilles-presenter.service';
import { LeMarcheDesMerveillesService } from './application/services/le-marche-des-merveilles.service';
import { LeMarcheDesMerveillesSetupService } from './application/services/le-marche-des-merveilles-setup.service';

@Module({
  imports: [GameCoreModule, BoardGameCoreKitModule],
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





