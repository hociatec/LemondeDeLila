import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../../core/core.module';
import { CardsModule } from '../../../../modules/cards/cards.module';
import { TurnModule } from '../../../../modules/turn/turn.module';
import { GameRegistryModule } from '../../../../engine/game-registry.module';
import { ActionResolverModule } from '../../../../modules/action-resolver/action-resolver.module';
import { ActionLogModule } from '../../../../modules/actionlog/actionlog.module';
import { StateModule } from '../../../../modules/state/state.module';
import { VictoryModule } from '../../../../modules/victory/victory.module';
import { BotModule } from '../../../../modules/bot/bot.module';
import { DameNatureService } from './services/dame-nature.service';
import { DameNaturePollutionService } from './services/dame-nature-pollution.service';
import { DameNatureSetupService } from './services/dame-nature-setup.service';
import { DameNatureBooksService } from './services/dame-nature-books.service';
import { DameNatureActionService } from './services/dame-nature-action.service';
import { DameNatureBotService } from './services/dame-nature-bot.service';

@Module({
  imports: [
    GameCoreModule,
    CardsModule,
    TurnModule,
    GameRegistryModule,
    ActionResolverModule,
    ActionLogModule,
    StateModule,
    VictoryModule,
    BotModule,
  ],
  providers: [
    DameNatureService,
    DameNaturePollutionService,
    DameNatureSetupService,
    DameNatureBooksService,
    DameNatureActionService,
    DameNatureBotService,
  ],
  exports: [
    DameNatureService,
    DameNaturePollutionService,
    DameNatureSetupService,
    DameNatureBooksService,
    DameNatureActionService,
    DameNatureBotService,
  ],
})
export class DameNatureModule {}
