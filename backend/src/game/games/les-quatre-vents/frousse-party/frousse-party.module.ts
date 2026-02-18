import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { BoardEffectsPoliciesModule } from '../../../modules/board-effects-policies/board-effects-policies.module';
import { TurnPoliciesModule } from '../../../modules/turn-policies/turn-policies.module';
import { PromptPoliciesModule } from '../../../modules/prompt-policies/prompt-policies.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { FroussePartyService } from './frousse-party.service';
import { FrousseSetupService } from './setup/frousse-setup.service';
import { FrousseActionService } from './actions/frousse-action.service';
import { FroussePresenterService } from './presenter/frousse-presenter.service';
import { FrousseBotService } from './bots/frousse-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
    BoardEffectsPoliciesModule,
    TurnPoliciesModule,
    PromptPoliciesModule,
  ],
  providers: [
    FroussePartyService,
    FrousseSetupService,
    FrousseActionService,
    FroussePresenterService,
    FrousseBotService,
  ],
  exports: [FroussePartyService],
})
export class FroussePartyModule {}
