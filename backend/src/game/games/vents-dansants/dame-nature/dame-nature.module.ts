import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { CardsModule } from '../../../modules/cards/cards.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { ActionResolverModule } from '../../../modules/action-resolver/action-resolver.module';
import { ActionLogModule } from '../../../modules/actionlog/actionlog.module';
import { StateModule } from '../../../modules/state/state.module';
import { VictoryModule } from '../../../modules/victory/victory.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { DameNatureService } from './dame-nature.service';
import { DameNaturePollutionService } from './actions/dame-nature-pollution.service';
import { DameNatureSetupService } from './setup/dame-nature-setup.service';
import { DameNatureBooksService } from './actions/dame-nature-books.service';
import { DameNatureActionService } from './actions/dame-nature-action.service';
import { DameNatureBotService } from './bots/dame-nature-bot.service';
import { DameNaturePhaseService } from './phases/dame-nature-phase.service';
import { DameNaturePresenterService } from './presenter/dame-nature-presenter.service';

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
    EngineServicesModule,
  ],
  providers: [
    DameNatureService,
    DameNaturePollutionService,
    DameNatureSetupService,
    DameNatureBooksService,
    DameNatureActionService,
    DameNatureBotService,
    DameNaturePhaseService,
    DameNaturePresenterService,
  ],
  exports: [
    DameNatureService,
    DameNaturePollutionService,
    DameNatureSetupService,
    DameNatureBooksService,
    DameNatureActionService,
    DameNatureBotService,
    DameNaturePhaseService,
    DameNaturePresenterService,
  ],
})
export class DameNatureModule {}
