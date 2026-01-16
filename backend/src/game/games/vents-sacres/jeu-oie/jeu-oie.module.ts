import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { BoardModule } from '../../../modules/board/board.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { JeuOieService } from './jeu-oie.service';
import { JeuOieSetupService } from './setup/jeu-oie-setup.service';
import { JeuOieActionService } from './actions/jeu-oie-action.service';
import { JeuOiePhaseService } from './phases/jeu-oie-phase.service';
import { JeuOiePresenterService } from './presenter/jeu-oie-presenter.service';
import { JeuOieBotService } from './bots/jeu-oie-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    JeuOieService,
    JeuOieSetupService,
    JeuOieActionService,
    JeuOiePhaseService,
    JeuOiePresenterService,
    JeuOieBotService,
  ],
  exports: [JeuOieService],
})
export class JeuOieModule {}
