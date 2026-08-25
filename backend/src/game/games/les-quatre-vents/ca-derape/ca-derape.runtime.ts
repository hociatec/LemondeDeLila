import { GameCoreService } from '../../../core/application/services/game-core.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { CaActionService } from './application/services/ca-actions.service';
import { CaBotService } from './application/services/ca-bot.service';
import { CaDerapeService } from './application/services/ca-derape.service';
import { CaPresenterService } from './application/services/ca-presenter.service';
import { CaSetupService } from './setup/ca.setup';

export function createCaDerapeRuntime(
  overrides: {
    random?: RandomService;
    core?: GameCoreService;
    turns?: TurnFlowService;
    boardPayload?: BoardPayloadService;
    deckPolicies?: DeckPoliciesService;
    botRunner?: BotRunnerService;
  } = {},
): { service: CaDerapeService } {
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const boardPayload = overrides.boardPayload ?? new BoardPayloadService();
  const deckPolicies =
    overrides.deckPolicies ?? new DeckPoliciesService(random);
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = new CaSetupService();
  const actions = new CaActionService(random, turns, core, deckPolicies);
  const presenter = new CaPresenterService(boardPayload);
  const bots = new CaBotService(botRunner);

  return {
    service: new CaDerapeService(setup, actions, presenter, bots),
  };
}
