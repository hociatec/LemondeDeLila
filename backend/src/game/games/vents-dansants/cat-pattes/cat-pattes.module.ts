import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { TurnPoliciesModule } from '../../../application/modules/turn-policies.module';
import { PromptPoliciesModule } from '../../../application/modules/prompt-policies.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { GameCoreService } from '../../../application/services/game-core.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { PromptPoliciesService } from '../../../application/services/prompt-policies.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
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
    PromptPoliciesModule,
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





