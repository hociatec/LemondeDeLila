import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { TurnPoliciesModule } from '../../../modules/turn-policies/turn-policies.module';
import { PromptPoliciesModule } from '../../../modules/prompt-policies/prompt-policies.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { CatPattesService } from './cat-pattes.service';
import { CatPattesSetupService } from './setup/cat-pattes-setup.service';
import { CatPattesActionService } from './actions/cat-pattes-action.service';
import { CatPattesPresenterService } from './presenter/cat-pattes-presenter.service';
import { CatPattesBotService } from './bots/cat-pattes-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    BoardGameDeckKitModule,
    TurnPoliciesModule,
    PromptPoliciesModule,
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
