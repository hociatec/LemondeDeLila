import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { PiratesEnVadrouilleService } from './pirates-en-vadrouille.service';
import { PiratesEnVadrouilleSetupService } from './setup/pirates-en-vadrouille-setup.service';
import { PiratesEnVadrouilleActionService } from './actions/pirates-en-vadrouille-action.service';
import { PiratesEnVadrouillePresenterService } from './presenter/pirates-en-vadrouille-presenter.service';
import { PiratesEnVadrouilleBotService } from './bots/pirates-en-vadrouille-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
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
