import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { BoardModule } from '../../../modules/board/board.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { AFondLesBallonsService } from './a-fond-les-ballons.service';
import { AFondLesBallonsSetupService } from './setup/a-fond-les-ballons-setup.service';
import { AFondLesBallonsActionService } from './actions/a-fond-les-ballons-action.service';
import { AFondLesBallonsPresenterService } from './presenter/a-fond-les-ballons-presenter.service';
import { AFondLesBallonsBotService } from './bots/a-fond-les-ballons-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    DeckPoliciesModule,
    BoardModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    AFondLesBallonsService,
    AFondLesBallonsSetupService,
    AFondLesBallonsActionService,
    AFondLesBallonsPresenterService,
    AFondLesBallonsBotService,
  ],
  exports: [AFondLesBallonsService],
})
export class AFondLesBallonsModule {}
