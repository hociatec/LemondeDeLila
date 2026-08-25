import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { DeckPoolService, DeckManagerService } from '../../../../../cards/public-api';
import { BoardMovementService } from '../../../../../core/application/services/board-movement.service';
import { BoardPayloadService } from '../../../../../core/application/services/board-payload.service';
import { TileEffectRegistryService } from '../../../../../effects/application/services/tile-effect-registry.service';
import { StandEffectRegistryService } from '../../../../../effects/application/services/stand-effect-registry.service';
import { TurnActionsService } from '../../../../../core/application/services/turn-actions.service';
import { TurnService } from '../../../../../core/application/services/turn.service';
import { TurnFlowService } from '../../../../../core/application/services/turn-flow.service';
import { TurnStatusService } from '../../../../../core/application/services/turn-status.service';
import { TurnPoliciesService } from '../../../../../core/application/services/turn-policies.service';
import { ActionResolverService } from '../../../../../action-resolver/application/services/action-resolver.service';
import { QuizRunnerService } from '../../../../../quiz/application/services/quiz-runner.service';
import { VictoryService } from '../../../../../victory/application/services/victory.service';
import { ActionLogService } from '../../../../../actionlog/application/services/action-log.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { BotRunnerService } from '../../../../../core/application/services/bot-runner.service';
import { InteractiveExchangeService } from '../../../../../exchange/application/services/interactive-exchange.service';
import { GameContentLoaderService } from '../../../../../core/application/services/game-content-loader.service';
import { FilesystemGameCatalogReader } from '../../../../../core/infrastructure/system/filesystem-game-catalog.reader';
import { PanierExpressService } from '../../application/services/panier-express.service';
import { PanierExpressSetupService } from '../../application/services/panier-express-setup.service';
import { PanierExpressDrawService } from '../../application/services/panier-express-draw.service';
import { PanierExpressQuizService } from '../../application/services/panier-express-quiz.service';
import { PanierExpressExchangeService } from '../../application/services/panier-express-exchange.service';
import { PanierExpressUtils } from '../../application/services/panier-express-utils.service';
import { PanierExpressDeckService } from '../../application/services/panier-express-deck.service';
import { PanierExpressBotService } from '../../application/services/panier-express-bot.service';
import { PanierExpressPhaseService } from '../../application/services/panier-express-phase.service';
import { PanierExpressPresenterService } from '../../application/services/panier-express-presenter.service';
import { PanierExpressStateService } from '../../application/services/panier-express-state.service';

export async function createPanierExpressTestingModule() {
  const core = new GameCoreService();
  const random = new RandomService();
  const deckPool = new DeckPoolService();
  const deckManager = new DeckManagerService(random);
  const movement = new BoardMovementService();
  const boardPayload = new BoardPayloadService();
  const tileRegistry = new TileEffectRegistryService<
    import('../../../../../core/application/models/game-state.model').GameStateEntity,
    {
      playerId: number;
      tile: import('../../model/panier-express-state.model').PanierExpressTile;
    }
  >();
  const standEffects = new StandEffectRegistryService<
    import('../../../../../core/application/models/game-state.model').GameStateEntity
  >(new TileEffectRegistryService());
  const turnActions = new TurnActionsService();
  const turnService = new TurnService();
  const turnPolicies = new TurnPoliciesService(core);
  const turnFlow = new TurnFlowService(turnService, turnPolicies);
  const turnStatus = new TurnStatusService();
  const actionResolver = new ActionResolverService();
  const quizRunner = new QuizRunnerService();
  const victory = new VictoryService();
  const actionLog = new ActionLogService();
  const setupFlow = new SetupFlowService();
  const exchangeFlow = new InteractiveExchangeService(random);
  const catalogReader = new FilesystemGameCatalogReader();
  const safeCatalogReader = {
    listEntries: () => catalogReader.listEntries(),
    readTextFile: (filePath: string) => catalogReader.readTextFile(filePath),
    loadJsonFile: <T>(params: {
      baseDir: string;
      contentDir?: string;
      filename: string;
    }): T => {
      const filePath = path.join(
        params.baseDir,
        params.contentDir ?? '',
        params.filename,
      );
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      return JSON.parse(raw) as T;
    },
  };
  const contentLoader = new GameContentLoaderService(safeCatalogReader as any);
  const setup = new PanierExpressSetupService(
    deckManager,
    deckPool,
    contentLoader,
  );
  const utils = new PanierExpressUtils();
  const deckHelper = new PanierExpressDeckService(deckPool, random);
  const drawService = new PanierExpressDrawService(
    setup,
    core,
    utils,
    deckHelper,
  );
  const quizService = new PanierExpressQuizService(
    deckPool,
    quizRunner,
    core,
    utils,
    random,
  );
  const exchangeService = new PanierExpressExchangeService(
    core,
    utils,
    deckHelper,
    exchangeFlow,
    setup,
    random,
  );
  const fakeBotRunner = {
    choose: (actions: any[], _ctx: any, _profile: any, opts: any) => {
      const safe = Array.isArray(actions) ? actions : [];
      const prefer: string[] = Array.isArray(opts?.preferTypes)
        ? opts.preferTypes
        : [];
      for (const type of prefer) {
        const match = safe.find(
          (a) => (a?.type || '').toLowerCase() === String(type).toLowerCase(),
        );
        if (match) return [match];
      }
      const fallback: string[] = Array.isArray(opts?.fallbackTypes)
        ? opts.fallbackTypes
        : [];
      for (const type of fallback) {
        const match = safe.find(
          (a) => (a?.type || '').toLowerCase() === String(type).toLowerCase(),
        );
        if (match) return [match];
      }
      return safe.length ? [safe[0]] : [];
    },
    suggestForHandler: () => null,
  } as unknown as BotRunnerService;
  const botService = new PanierExpressBotService(fakeBotRunner, turnStatus);
  const phaseService = new PanierExpressPhaseService(
    core,
    turnFlow,
    victory,
    actionLog,
    utils,
  );
  const presenter = new PanierExpressPresenterService(utils, boardPayload);
  const stateService = new PanierExpressStateService(setup, utils);
  const game = new PanierExpressService(
    core,
    turnService,
    deckPool,
    movement,
    tileRegistry,
    turnActions,
    standEffects,
    actionResolver,
    turnStatus,
    victory,
    fakeBotRunner,
    actionLog,
    setup,
    drawService,
    quizService,
    quizRunner,
    exchangeService,
    utils,
    botService,
    phaseService,
    presenter,
    stateService,
    random,
    setupFlow,
  );
  game.onModuleInit();

  const services = new Map<unknown, unknown>([
    [GameCoreService, core],
    [DeckPoolService, deckPool],
    [DeckManagerService, deckManager],
    [BoardMovementService, movement],
    [BoardPayloadService, boardPayload],
    [TileEffectRegistryService, tileRegistry],
    [StandEffectRegistryService, standEffects],
    [TurnActionsService, turnActions],
    [TurnService, turnService],
    [TurnPoliciesService, turnPolicies],
    [TurnFlowService, turnFlow],
    [TurnStatusService, turnStatus],
    [ActionResolverService, actionResolver],
    [QuizRunnerService, quizRunner],
    [VictoryService, victory],
    [ActionLogService, actionLog],
    [RandomService, random],
    [SetupFlowService, setupFlow],
    [InteractiveExchangeService, exchangeFlow],
    [FilesystemGameCatalogReader, catalogReader],
    [GameContentLoaderService, contentLoader],
    [PanierExpressSetupService, setup],
    [PanierExpressDrawService, drawService],
    [PanierExpressQuizService, quizService],
    [PanierExpressExchangeService, exchangeService],
    [PanierExpressUtils, utils],
    [PanierExpressDeckService, deckHelper],
    [PanierExpressBotService, botService],
    [PanierExpressPhaseService, phaseService],
    [PanierExpressPresenterService, presenter],
    [PanierExpressStateService, stateService],
    [PanierExpressService, game],
    [BotRunnerService, fakeBotRunner],
  ]);

  return {
    get<T>(token: new (...args: any[]) => T): T {
      return services.get(token) as T;
    },
    init: async () => undefined,
  };
}
