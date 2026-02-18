import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { TurnPoliciesModule } from '../../../modules/turn-policies/turn-policies.module';
import { PromptPoliciesModule } from '../../../modules/prompt-policies/prompt-policies.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { JeuOieService } from './jeu-oie.service';
import { JeuOieSetupService } from './setup/jeu-oie-setup.service';
import { JeuOieActionService } from './actions/jeu-oie-action.service';
import { JeuOiePhaseService } from './phases/jeu-oie-phase.service';
import { JeuOiePresenterService } from './presenter/jeu-oie-presenter.service';
import { JeuOieBotService } from './bots/jeu-oie-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    BoardGameCoreKitModule,
    SetupFlowModule,
    TurnPoliciesModule,
    PromptPoliciesModule,
  ],
  providers: [
    JeuOieService,
    JeuOieSetupService,
    JeuOieActionService,
    JeuOiePhaseService,
    JeuOiePresenterService,
    JeuOieBotService,
  ],
  exports: [JeuOieService],
})
export class JeuOieModule {}
