import { Module } from '@nestjs/common';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { GameCoreModule } from '../../../module/game-core.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
import { TurnPoliciesModule } from '../../../application/modules/turn-policies.module';
import { PromptPoliciesModule } from '../../../application/modules/prompt-policies.module';
import { BoardGameCoreKitModule } from '../../../module/board-game-kits.module';
import { JeuOieService } from './application/services/jeu-oie.service';
import { JeuOieSetupService } from './application/services/jeu-oie-setup.service';
import { JeuOieActionService } from './application/services/jeu-oie-action.service';
import { JeuOiePhaseService } from './application/services/jeu-oie-phase.service';
import { JeuOiePresenterService } from './application/services/jeu-oie-presenter.service';
import { JeuOieBotService } from './application/services/jeu-oie-bot.service';

@Module({
  imports: [
    GameCoreModule,
    EngineServicesModule,
    BoardGameCoreKitModule,
    SetupFlowModule,
    TurnPoliciesModule,
    PromptPoliciesModule,
  ],
  providers: [
    RandomService,
    {
      provide: JeuOieSetupService,
      inject: [GameCoreService, GameContentLoaderService, SetupFlowService],
      useFactory: (
        core: GameCoreService,
        contentLoader: GameContentLoaderService,
        setupFlow: SetupFlowService,
      ) => new JeuOieSetupService(core, contentLoader, setupFlow),
    },
    {
      provide: JeuOieActionService,
      inject: [
        RandomService,
        TurnFlowService,
        GameCoreService,
        SetupFlowService,
        TurnPoliciesService,
      ],
      useFactory: (
        random: RandomService,
        turns: TurnFlowService,
        core: GameCoreService,
        setupFlow: SetupFlowService,
        turnPolicies: TurnPoliciesService,
      ) =>
        new JeuOieActionService(
          random,
          turns,
          core,
          setupFlow,
          turnPolicies,
        ),
    },
    {
      provide: JeuOiePhaseService,
      useFactory: () => new JeuOiePhaseService(),
    },
    {
      provide: JeuOiePresenterService,
      inject: [BoardPayloadService],
      useFactory: (boardPayload: BoardPayloadService) =>
        new JeuOiePresenterService(boardPayload),
    },
    {
      provide: JeuOieBotService,
      inject: [BotRunnerService],
      useFactory: (botRunner: BotRunnerService) => new JeuOieBotService(botRunner),
    },
    {
      provide: JeuOieService,
      inject: [
        JeuOieSetupService,
        JeuOieActionService,
        JeuOiePhaseService,
        JeuOiePresenterService,
        JeuOieBotService,
      ],
      useFactory: (
        setup: JeuOieSetupService,
        actions: JeuOieActionService,
        phases: JeuOiePhaseService,
        presenter: JeuOiePresenterService,
        bots: JeuOieBotService,
      ) => new JeuOieService(setup, actions, phases, presenter, bots),
    },
  ],
  exports: [JeuOieService],
})
export class JeuOieModule {}






