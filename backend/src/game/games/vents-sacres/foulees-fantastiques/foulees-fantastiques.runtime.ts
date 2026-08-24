import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { TurnService } from '../../../application/services/turn.service';
import { FouleesFantastiquesActionService } from './application/services/foulees-fantastiques-action.service';
import { FouleesFantastiquesBotService } from './application/services/foulees-fantastiques-bot.service';
import { FouleesFantastiquesPhaseService } from './application/services/foulees-fantastiques-phase.service';
import { FouleesFantastiquesPresenterService } from './application/services/foulees-fantastiques-presenter.service';
import { FouleesFantastiquesSetupService } from './application/services/foulees-fantastiques-setup.service';
import { FouleesFantastiquesService } from './application/services/foulees-fantastiques.service';

type MinimalContentLoader = Pick<GameContentLoaderService, 'loadContent' | 'validators'>;

function createDefaultContentLoader(): MinimalContentLoader {
  return {
    validators: {
      version: () => () => undefined,
      arrayField: () => () => undefined,
      positiveNumber: () => () => undefined,
    } as GameContentLoaderService['validators'],
    loadContent: () => {
      throw new Error(
        'FouleesFantastiques runtime requires a contentLoader override for content-dependent flows.',
      );
    },
  };
}

export function createFouleesFantastiquesRuntime(
  overrides: {
    contentLoader?: MinimalContentLoader;
    core?: GameCoreService;
    setupFlow?: SetupFlowService;
    random?: RandomService;
    turns?: TurnFlowService;
    boardPayload?: BoardPayloadService;
    botRunner?: BotRunnerService;
  } = {},
): { service: FouleesFantastiquesService } {
  const contentLoader = overrides.contentLoader ?? createDefaultContentLoader();
  const core = overrides.core ?? new GameCoreService();
  const setupFlow = overrides.setupFlow ?? new SetupFlowService();
  const random = overrides.random ?? new RandomService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const boardPayload = overrides.boardPayload ?? new BoardPayloadService();
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = new FouleesFantastiquesSetupService(
    core,
    contentLoader as GameContentLoaderService,
    setupFlow,
  );
  const actions = new FouleesFantastiquesActionService(
    random,
    turns,
    core,
    setup,
    setupFlow,
  );
  const phases = new FouleesFantastiquesPhaseService();
  const presenter = new FouleesFantastiquesPresenterService(boardPayload);
  const bots = new FouleesFantastiquesBotService(botRunner);

  return {
    service: new FouleesFantastiquesService(
      setup,
      actions,
      phases,
      presenter,
      bots,
    ),
  };
}
