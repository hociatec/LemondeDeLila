import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { BoardModule } from '../../../modules/board/board.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { TurnPoliciesModule } from '../../../modules/turn-policies/turn-policies.module';
import { PromptPoliciesModule } from '../../../modules/prompt-policies/prompt-policies.module';
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
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
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
