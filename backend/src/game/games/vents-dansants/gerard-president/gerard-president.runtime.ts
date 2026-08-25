import { RandomService } from '../../../core/application/services/random.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { GerardPresidentActionService } from './application/services/gerard-president-action.service';
import { GerardPresidentBotService } from './application/services/gerard-president-bot.service';
import { GerardPresidentPresenterService } from './application/services/gerard-president-presenter.service';
import { GerardPresidentService } from './application/services/gerard-president.service';
import { GerardPresidentSetupService } from './application/services/gerard-president-setup.service';

export function createGerardPresidentRuntime(): { service: GerardPresidentService } {
  const random = new RandomService();
  const deckPolicies = new DeckPoliciesService(random);
  const botRunner = new BotRunnerService(new BotStrategyService(random));
  const setup = new GerardPresidentSetupService(random);
  const actions = new GerardPresidentActionService(random, deckPolicies);
  const presenter = new GerardPresidentPresenterService();
  const bots = new GerardPresidentBotService(botRunner);

  return {
    service: new GerardPresidentService(setup, actions, presenter, bots),
  };
}
