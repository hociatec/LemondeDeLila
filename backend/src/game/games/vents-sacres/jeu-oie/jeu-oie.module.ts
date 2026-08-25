import { Module } from '@nestjs/common';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
import { TurnPoliciesModule } from '../../../core/infrastructure/module/turn-policies.module';
import { PromptsModule } from '../../../prompts/public-api';
import { BoardGameCoreKitModule } from '../../../composition/board-game-kits.module';
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
    PromptsModule,
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






