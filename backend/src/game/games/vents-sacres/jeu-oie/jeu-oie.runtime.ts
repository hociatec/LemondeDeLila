import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { TurnService } from '../../../application/services/turn.service';
import { JeuOieActionService } from './application/services/jeu-oie-action.service';
import { JeuOieBotService } from './application/services/jeu-oie-bot.service';
import { JeuOiePhaseService } from './application/services/jeu-oie-phase.service';
import { JeuOiePresenterService } from './application/services/jeu-oie-presenter.service';
import { JeuOieSetupService } from './application/services/jeu-oie-setup.service';
import { JeuOieService } from './application/services/jeu-oie.service';

type MinimalContentLoader = Pick<
  GameContentLoaderService,
  'loadContent' | 'validators'
>;

function createDefaultContentLoader(): MinimalContentLoader {
  return {
    validators: {
      version: () => () => undefined,
      arrayField: () => () => undefined,
      requiredFields: () => () => undefined,
      positiveNumber: () => () => undefined,
    },
    loadContent: () => {
      throw new Error(
        'JeuOie runtime requires a contentLoader override for content-dependent flows.',
      );
    },
  };
}

export function createJeuOieRuntime(
  overrides: {
    contentLoader?: MinimalContentLoader;
    random?: RandomService;
    core?: GameCoreService;
    setupFlow?: SetupFlowService;
    turns?: TurnFlowService;
    turnPolicies?: TurnPoliciesService;
    boardPayload?: BoardPayloadService;
    botRunner?: BotRunnerService;
  } = {},
): { service: JeuOieService } {
  const contentLoader = overrides.contentLoader ?? createDefaultContentLoader();
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const setupFlow = overrides.setupFlow ?? new SetupFlowService();
  const turns =
    overrides.turns ??
    new TurnFlowService(
      new TurnService(),
      overrides.turnPolicies ?? new TurnPoliciesService(core),
    );
  const turnPolicies = overrides.turnPolicies ?? new TurnPoliciesService(core);
  const boardPayload = overrides.boardPayload ?? new BoardPayloadService();
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = new JeuOieSetupService(
    core,
    contentLoader as GameContentLoaderService,
    setupFlow,
  );
  const actions = new JeuOieActionService(
    random,
    turns,
    core,
    setupFlow,
    turnPolicies,
  );
  const phases = new JeuOiePhaseService();
  const presenter = new JeuOiePresenterService(boardPayload);
  const bots = new JeuOieBotService(botRunner);

  return {
    service: new JeuOieService(setup, actions, phases, presenter, bots),
  };
}
