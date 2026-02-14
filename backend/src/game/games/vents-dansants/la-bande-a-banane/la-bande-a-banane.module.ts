import { Module } from '@nestjs/common';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { BandeABananeActionService } from './actions/la-bande-a-banane-action.service';
import { BandeABananeBotService } from './bots/la-bande-a-banane-bot.service';
import { BandeABananePresenterService } from './presenter/la-bande-a-banane-presenter.service';
import { BandeABananeSetupService } from './setup/la-bande-a-banane-setup.service';
import { BandeABananeService } from './la-bande-a-banane.service';

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
    BandeABananeService,
    BandeABananeSetupService,
    BandeABananeActionService,
    BandeABananePresenterService,
    BandeABananeBotService,
  ],
  exports: [BandeABananeService],
})
export class BandeABananeModule {}
