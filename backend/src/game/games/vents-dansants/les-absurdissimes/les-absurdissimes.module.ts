import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { AbsurdissimesActionService } from './actions/les-absurdissimes-action.service';
import { AbsurdissimesBotService } from './bots/les-absurdissimes-bot.service';
import { AbsurdissimesDeckService } from './data/absurdissimes-deck.service';
import { AbsurdissimesPresenterService } from './presenter/les-absurdissimes-presenter.service';
import { AbsurdissimesSetupService } from './setup/les-absurdissimes-setup.service';
import { LesAbsurdissimesService } from './les-absurdissimes.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule, GameRegistryModule],
  providers: [
    LesAbsurdissimesService,
    AbsurdissimesDeckService,
    AbsurdissimesSetupService,
    AbsurdissimesActionService,
    AbsurdissimesPresenterService,
    AbsurdissimesBotService,
  ],
  exports: [LesAbsurdissimesService],
})
export class LesAbsurdissimesModule {}
