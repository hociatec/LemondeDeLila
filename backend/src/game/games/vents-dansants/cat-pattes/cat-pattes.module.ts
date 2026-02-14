import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { CatPattesService } from './cat-pattes.service';
import { CatPattesSetupService } from './setup/cat-pattes-setup.service';
import { CatPattesActionService } from './actions/cat-pattes-action.service';
import { CatPattesPresenterService } from './presenter/cat-pattes-presenter.service';
import { CatPattesBotService } from './bots/cat-pattes-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
    SetupFlowModule,
    DeckPoliciesModule,
  ],
  providers: [
    CatPattesService,
    CatPattesSetupService,
    CatPattesActionService,
    CatPattesPresenterService,
    CatPattesBotService,
  ],
  exports: [CatPattesService],
})
export class CatPattesModule {}
