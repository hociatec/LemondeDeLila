import { GameCoreService } from '../../../core/application/services/game-core.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { RandomService } from '../../../core/application/services/random.service';
import { PromptPoliciesService } from '../../../prompts/public-api';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { CatPattesActionService } from './application/services/cat-pattes-action.service';
import { CatPattesBotService } from './application/services/cat-pattes-bot.service';
import { CatPattesPresenterService } from './application/services/cat-pattes-presenter.service';
import { CatPattesService } from './application/services/cat-pattes.service';
import { CatPattesSetupService } from './application/services/cat-pattes-setup.service';

export function createCatPattesRuntime(): { service: CatPattesService } {
  const core = new GameCoreService();
  const random = new RandomService();
  const turns = new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const deckPolicies = new DeckPoliciesService(random);
  const turnPolicies = new TurnPoliciesService(core);
  const promptPolicies = new PromptPoliciesService();
  const botRunner = new BotRunnerService(new BotStrategyService());
  const setup = new CatPattesSetupService(core, random);
  const actions = new CatPattesActionService(
    core,
    turns,
    deckPolicies,
    random,
    turnPolicies,
    promptPolicies,
  );
  const presenter = new CatPattesPresenterService();
  const bots = new CatPattesBotService(botRunner);

  return {
    service: new CatPattesService(setup, actions, presenter, bots),
  };
}
