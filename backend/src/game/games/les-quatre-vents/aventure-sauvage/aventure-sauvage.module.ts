import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { BoardEffectsPoliciesModule } from '../../../modules/board-effects-policies/board-effects-policies.module';
import { TurnPoliciesModule } from '../../../modules/turn-policies/turn-policies.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { AventureSauvageService } from './aventure-sauvage.service';
import { AventureSauvageSetupService } from './setup/aventure-sauvage-setup.service';
import { AventureSauvageActionService } from './actions/aventure-sauvage-action.service';
import { AventureSauvagePresenterService } from './presenter/aventure-sauvage-presenter.service';
import { AventureSauvageBotService } from './bots/aventure-sauvage-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
    BoardEffectsPoliciesModule,
    TurnPoliciesModule,
  ],
  providers: [
    AventureSauvageService,
    AventureSauvageSetupService,
    AventureSauvageActionService,
    AventureSauvagePresenterService,
    AventureSauvageBotService,
  ],
  exports: [AventureSauvageService],
})
export class AventureSauvageModule {}
