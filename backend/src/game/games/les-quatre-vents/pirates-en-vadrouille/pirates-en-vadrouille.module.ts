import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { PiratesEnVadrouilleService } from './application/services/pirates-en-vadrouille.service';
import { PiratesEnVadrouilleSetupService } from './application/services/pirates-en-vadrouille-setup.service';
import { PiratesEnVadrouilleActionService } from './application/services/pirates-en-vadrouille-action.service';
import { PiratesEnVadrouillePresenterService } from './application/services/pirates-en-vadrouille-presenter.service';
import { PiratesEnVadrouilleBotService } from './application/services/pirates-en-vadrouille-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    EngineServicesModule,
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






