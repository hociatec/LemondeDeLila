import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { TurnPoliciesModule } from '../../../core/infrastructure/module/turn-policies.module';
import { PromptsModule } from '../../../prompts/public-api';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { PromptPoliciesService } from '../../../prompts/public-api';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { CatPattesService } from './application/services/cat-pattes.service';
import { CatPattesSetupService } from './application/services/cat-pattes-setup.service';
import { CatPattesActionService } from './application/services/cat-pattes-action.service';
import { CatPattesPresenterService } from './application/services/cat-pattes-presenter.service';
import { CatPattesBotService } from './application/services/cat-pattes-bot.service';

@Module({
  imports: [
    GameCoreModule,
    BoardGameDeckKitModule,
    TurnPoliciesModule,
    PromptsModule,
  ],
  providers: [
    DeckPoliciesService,
    RandomService,
    {
      provide: CatPattesSetupService,
      useFactory: (core: GameCoreService, random: RandomService) =>
        new CatPattesSetupService(core, random),
      inject: [GameCoreService, RandomService],
    },
    {
      provide: CatPattesActionService,
      useFactory: (
        core: GameCoreService,
        turns: TurnFlowService,
        deckPolicies: DeckPoliciesService,
        random: RandomService,
        turnPolicies: TurnPoliciesService,
        promptPolicies: PromptPoliciesService,
      ) =>
        new CatPattesActionService(
          core,
          turns,
          deckPolicies,
          random,
          turnPolicies,
          promptPolicies,
        ),
      inject: [
        GameCoreService,
        TurnFlowService,
        DeckPoliciesService,
        RandomService,
        TurnPoliciesService,
        PromptPoliciesService,
      ],
    },
    {
      provide: CatPattesPresenterService,
      useFactory: () => new CatPattesPresenterService(),
    },
    {
      provide: CatPattesBotService,
      useFactory: (botRunner: BotRunnerService) =>
        new CatPattesBotService(botRunner),
      inject: [BotRunnerService],
    },
    {
      provide: CatPattesService,
      useFactory: (
        setup: CatPattesSetupService,
        actions: CatPattesActionService,
        presenter: CatPattesPresenterService,
        bots: CatPattesBotService,
      ) => new CatPattesService(setup, actions, presenter, bots),
      inject: [
        CatPattesSetupService,
        CatPattesActionService,
        CatPattesPresenterService,
        CatPattesBotService,
      ],
    },
  ],
  exports: [CatPattesService],
})
export class CatPattesModule {}





