import { Module } from '@nestjs/common';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { ABSURDISSIMES_DECK_PORT } from './application/ports/absurdissimes-deck.port';
import { AbsurdissimesActionService } from './application/services/les-absurdissimes-action.service';
import { AbsurdissimesBotService } from './application/services/les-absurdissimes-bot.service';
import { AbsurdissimesDeckService } from './infrastructure/content/absurdissimes-deck.service';
import { AbsurdissimesPresenterService } from './application/services/les-absurdissimes-presenter.service';
import { AbsurdissimesSetupService } from './application/services/les-absurdissimes-setup.service';
import { LesAbsurdissimesService } from './application/services/les-absurdissimes.service';

@Module({
  imports: [GameCoreModule, BoardGameDeckKitModule],
  providers: [
    LesAbsurdissimesService,
    AbsurdissimesDeckService,
    {
      provide: ABSURDISSIMES_DECK_PORT,
      useExisting: AbsurdissimesDeckService,
    },
    AbsurdissimesSetupService,
    AbsurdissimesActionService,
    AbsurdissimesPresenterService,
    {
      provide: AbsurdissimesBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new AbsurdissimesBotService(botRunner),
      inject: [BotRunnerService],
    },
  ],
  exports: [LesAbsurdissimesService],
})
export class LesAbsurdissimesModule {}





