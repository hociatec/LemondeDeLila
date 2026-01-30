import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { PiratesEnVadrouilleService } from './pirates-en-vadrouille.service';
import { PiratesEnVadrouilleSetupService } from './setup/pirates-en-vadrouille-setup.service';
import { PiratesEnVadrouilleActionService } from './actions/pirates-en-vadrouille-action.service';
import { PiratesEnVadrouillePresenterService } from './presenter/pirates-en-vadrouille-presenter.service';
import { PiratesEnVadrouilleBotService } from './bots/pirates-en-vadrouille-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    PiratesEnVadrouilleService,
    PiratesEnVadrouilleSetupService,
    PiratesEnVadrouilleActionService,
    PiratesEnVadrouillePresenterService,
    PiratesEnVadrouilleBotService,
  ],
  exports: [PiratesEnVadrouilleService],
})
export class PiratesEnVadrouilleModule {}
