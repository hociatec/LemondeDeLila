import { Test } from '@nestjs/testing';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { DeckPoolService } from '../../../../modules/cards/services/deck-pool.service';
import { DeckManagerService } from '../../../../modules/cards/services/deck-manager.service';
import { BoardMovementService } from '../../../../modules/board/services/board-movement.service';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { TileEffectRegistryService } from '../../../../modules/effects/services/tile-effect-registry.service';
import { StandEffectRegistryService } from '../../../../modules/effects/services/stand-effect-registry.service';
import { TurnActionsService } from '../../../../modules/turn/services/turn-actions.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnStatusService } from '../../../../modules/turn/services/turn-status.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { ActionResolverService } from '../../../../modules/action-resolver/services/action-resolver.service';
import { QuizRunnerService } from '../../../../modules/quiz/services/quiz-runner.service';
import { VictoryService } from '../../../../modules/victory/services/victory.service';
import { ActionLogService } from '../../../../modules/actionlog/services/action-log.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import { InteractiveExchangeService } from '../../../../modules/exchange/services/interactive-exchange.service';
import { GameRegistryService } from '../../../../engine/services/game-registry.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { PanierExpressService } from '../panier-express.service';
import { PanierExpressSetupService } from '../setup/panier-express-setup.service';
import { PanierExpressDrawService } from '../actions/panier-express-draw.service';
import { PanierExpressQuizService } from '../actions/panier-express-quiz.service';
import { PanierExpressExchangeService } from '../actions/panier-express-exchange.service';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PanierExpressDeckService } from '../actions/panier-express-deck.service';
import { PanierExpressBotService } from '../bots/panier-express-bot.service';
import { PanierExpressPhaseService } from '../phases/panier-express-phase.service';
import { PanierExpressPresenterService } from '../presenter/panier-express-presenter.service';

export async function createPanierExpressTestingModule() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      GameCoreService,
      DeckPoolService,
      DeckManagerService,
      BoardMovementService,
      BoardPayloadService,
      TileEffectRegistryService,
      StandEffectRegistryService,
      TurnActionsService,
      TurnService,
      TurnPoliciesService,
      TurnFlowService,
      TurnStatusService,
      ActionResolverService,
      QuizRunnerService,
      VictoryService,
      ActionLogService,
      RandomService,
      InteractiveExchangeService,
      GameContentLoaderService,
      PanierExpressSetupService,
      PanierExpressDrawService,
      PanierExpressQuizService,
      PanierExpressExchangeService,
      PanierExpressUtils,
      PanierExpressDeckService,
      PanierExpressBotService,
      PanierExpressPhaseService,
      PanierExpressPresenterService,
      {
        provide: GameRegistryService,
        useValue: {
          register: (_handler: any) => {},
        } satisfies Partial<GameRegistryService>,
      },
      {
        provide: BotRunnerService,
        useValue: {
          choose: (actions: any[], _ctx: any, _profile: any, opts: any) => {
            const safe = Array.isArray(actions) ? actions : [];
            const prefer: string[] = Array.isArray(opts?.preferTypes)
              ? opts.preferTypes
              : [];
            for (const type of prefer) {
              const match = safe.find(
                (a) =>
                  (a?.type || '').toLowerCase() === String(type).toLowerCase(),
              );
              if (match) return [match];
            }
            const fallback: string[] = Array.isArray(opts?.fallbackTypes)
              ? opts.fallbackTypes
              : [];
            for (const type of fallback) {
              const match = safe.find(
                (a) =>
                  (a?.type || '').toLowerCase() === String(type).toLowerCase(),
              );
              if (match) return [match];
            }
            return safe.length ? [safe[0]] : [];
          },
          suggestForHandler: () => null,
        } as Partial<BotRunnerService>,
      },
      PanierExpressService,
    ],
  }).compile();

  await moduleRef.init();
  return moduleRef;
}
