import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { SacAMalicesActionService } from '../sac-a-malices/actions/sac-a-malices-action.service';
import { SacAMalicesPresenterService } from '../sac-a-malices/presenter/sac-a-malices-presenter.service';
import { SacAMalicesBotService } from '../sac-a-malices/bots/sac-a-malices-bot.service';
import { SacAMalicesRouteDesFlandresService } from './sac-a-malices-route-des-flandres.service';
import { SacAMalicesRouteDesFlandresSetupService } from './setup/sac-a-malices-route-des-flandres-setup.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    TurnModule,
    BoardModule,
    BotModule,
  ],
  providers: [
    SacAMalicesRouteDesFlandresService,
    SacAMalicesRouteDesFlandresSetupService,
    SacAMalicesActionService,
    SacAMalicesPresenterService,
    SacAMalicesBotService,
  ],
  exports: [SacAMalicesRouteDesFlandresService],
})
export class SacAMalicesRouteDesFlandresModule {}

