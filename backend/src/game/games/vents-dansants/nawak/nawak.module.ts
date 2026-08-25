import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { BoardGameCoreKitModule } from '../../../composition/board-game-kits.module';
import { NAWAK_CHALLENGE_PORT } from './application/ports/nawak-challenge.port';
import { NawakActionService } from './application/services/nawak-action.service';
import { NawakBotService } from './application/services/nawak-bot.service';
import { NawakChallengeService } from './infrastructure/content/nawak-challenge.service';
import { NawakPresenterService } from './application/services/nawak-presenter.service';
import { NawakSetupService } from './application/services/nawak-setup.service';
import { NawakService } from './application/services/nawak.service';

@Module({
  imports: [GameCoreModule, BoardGameCoreKitModule],
  providers: [
    NawakService,
    NawakChallengeService,
    {
      provide: NAWAK_CHALLENGE_PORT,
      useExisting: NawakChallengeService,
    },
    NawakSetupService,
    NawakActionService,
    NawakPresenterService,
    NawakBotService,
  ],
  exports: [NawakService],
})
export class NawakModule {}





