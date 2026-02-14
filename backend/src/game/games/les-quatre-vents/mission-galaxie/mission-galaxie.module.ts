import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { MissionGalaxieService } from './mission-galaxie.service';
import { MissionGalaxieSetupService } from './setup/mission-galaxie-setup.service';
import { MissionGalaxieActionService } from './actions/mission-galaxie-action.service';
import { MissionGalaxiePresenterService } from './presenter/mission-galaxie-presenter.service';
import { MissionGalaxieBotService } from './bots/mission-galaxie-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    DeckPoliciesModule,
    TurnModule,
    BoardModule,
    BotModule,
  ],
  providers: [
    MissionGalaxieService,
    MissionGalaxieSetupService,
    MissionGalaxieActionService,
    MissionGalaxiePresenterService,
    MissionGalaxieBotService,
  ],
  exports: [MissionGalaxieService],
})
export class MissionGalaxieModule {}
