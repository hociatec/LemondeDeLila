import { Test } from '@nestjs/testing';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { DeckPoolService } from '../../../../modules/cards/services/deck-pool.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { ActionResolverService } from '../../../../modules/action-resolver/services/action-resolver.service';
import { ActionLogService } from '../../../../modules/actionlog/services/action-log.service';
import { PhaseEngineService } from '../../../../modules/state/services/phase-engine.service';
import { VictoryService } from '../../../../modules/victory/services/victory.service';
import { GameRegistryService } from '../../../../engine/services/game-registry.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import { BotStrategyService } from '../../../../modules/bot/services/bot-strategy.service';
import { DameNatureService } from '../dame-nature.service';
import { DameNatureSetupService } from '../setup/dame-nature-setup.service';
import { DameNatureActionService } from '../actions/dame-nature-action.service';
import { DameNatureBotService } from '../bots/dame-nature-bot.service';
import { DameNatureBooksService } from '../actions/dame-nature-books.service';
import { DameNaturePhaseService } from '../phases/dame-nature-phase.service';
import { DameNaturePresenterService } from '../presenter/dame-nature-presenter.service';
import { DameNaturePollutionService } from '../actions/dame-nature-pollution.service';

export async function createDameNatureTestingModule() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      GameCoreService,
      DeckPoolService,
      TurnService,
      ActionResolverService,
      ActionLogService,
      PhaseEngineService,
      VictoryService,
      GameContentLoaderService,
      BotStrategyService,
      DameNatureSetupService,
      DameNaturePollutionService,
      DameNatureBooksService,
      DameNatureActionService,
      DameNatureBotService,
      DameNaturePhaseService,
      DameNaturePresenterService,
      {
        provide: GameRegistryService,
        useValue: {
          register: (_handler: any) => {},
        } satisfies Partial<GameRegistryService>,
      },
      {
        provide: BotRunnerService,
        useValue: {
          choose: (actions: any[]) => {
            const safe = Array.isArray(actions) ? actions : [];
            return safe.length ? [safe[0]] : [];
          },
          suggestForHandler: () => null,
        } as Partial<BotRunnerService>,
      },
      DameNatureService,
    ],
  }).compile();

  await moduleRef.init();
  return moduleRef;
}
