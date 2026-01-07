import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { ContesService } from './contes.service';
import { ContesCacahuetesSetupService } from './setup/contes-et-cacahuetes-setup.service';
import { ContesActionService } from './actions/contes-action.service';
import { ContesPresenterService } from './presenter/contes-presenter.service';
import { ContesBotService } from './bots/contes-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    ContesService,
    ContesCacahuetesSetupService,
    ContesActionService,
    ContesPresenterService,
    ContesBotService,
  ],
  exports: [ContesService],
})
export class ContesModule {}
