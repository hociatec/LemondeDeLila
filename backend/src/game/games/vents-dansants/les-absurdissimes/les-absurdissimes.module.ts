import { Module } from '@nestjs/common';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { AbsurdissimesActionService } from './actions/les-absurdissimes-action.service';
import { AbsurdissimesBotService } from './bots/les-absurdissimes-bot.service';
import { AbsurdissimesDeckService } from './data/absurdissimes-deck.service';
import { AbsurdissimesPresenterService } from './presenter/les-absurdissimes-presenter.service';
import { AbsurdissimesSetupService } from './setup/les-absurdissimes-setup.service';
import { LesAbsurdissimesService } from './les-absurdissimes.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    DeckPoliciesModule,
    BoardModule,
    TurnModule,
    BotModule,
  ],
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
