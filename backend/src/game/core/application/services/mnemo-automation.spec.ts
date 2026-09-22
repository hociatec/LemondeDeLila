import { compileJsonGame } from '../../../rules/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { GameAutomationPlannerService } from './game-automation-planner.service';
import { BotRunnerService } from './bot-runner.service';
import { BotSettingsService } from './bot-settings.service';
import { GameExecutionScopeService } from './game-execution-scope.service';
import { FixedGameClock } from '../models/game-execution-context.model';
import type { GameState } from '../models/game-state.model';
import manifest from '../../../games/vents-infinis/arche-de-mnemosyne/manifest.json';
import document from '../../../games/vents-infinis/arche-de-mnemosyne/game.json';
import quiz from '../../../games/vents-infinis/arche-de-mnemosyne/quiz.json';

const definition = compileJsonGame(manifest, document, {
  'content/quiz.json': quiz,
});
const runtime = new DeclarativeGameRuntime(definition);
const sessionId = 'choice-simultaneous-quiz.current';

function automation() {
  const clock = new FixedGameClock(1_700_000_000_000);
  const scope = new GameExecutionScopeService();
  const runner = new BotRunnerService();
  jest
    .spyOn(runner, 'suggestForHandler')
    .mockImplementation(
      (handler, state, id) =>
        handler?.getBotActions(state, id, scope.create(state, id, clock)) ??
        null,
    );
  const settings = Object.create(
    BotSettingsService.prototype,
  ) as BotSettingsService;
  jest.spyOn(settings, 'getBotStartDelayMs').mockReturnValue(1000);
  jest.spyOn(settings, 'getBotTurnDelayMs').mockReturnValue(1000);
  jest.spyOn(settings, 'getBotDrawDelayMs').mockReturnValue(250);
  const planner = new GameAutomationPlannerService(runner, settings);
  return {
    clock,
    scope,
    resolve: (state: GameState) =>
      scope.run(scope.create(state, null, clock), () =>
        planner.resolve(runtime, state),
      ),
  };
}

it('schedules the next bot draw using the configured bot draw delay', async () => {
  const game = await testGame(definition)
    .players(['Human', { username: 'Bot', isBot: true }])
    .start();
  await game.as(1).do('game.configure', document.simultaneousQuiz.defaults);
  await game.as(1).do('draw', {});
  await game.as(1).do('answer', { answerIndex: 0 });
  await game.as(-2).do('answer', { answerIndex: 0 });
  const { resolve, clock, scope } = automation();
  const state = game.state();
  const ready = resolve(state);
  expect(ready).toMatchObject({
    dueAtMs: clock.nowMs(),
    actions: [{ type: 'ready', meta: { actorId: -2 } }],
  });
  if (!ready) throw new Error('Missing ready action');
  const next = runtime.applyActions(
    state,
    ready.actions,
    scope.create(state, -2, clock),
  );
  const draw = resolve(next);
  expect(draw).toMatchObject({
    dueAtMs: clock.nowMs() + 250,
    actions: [{ type: 'draw', meta: { actorId: -2 } }],
  });
  if (!draw) throw new Error('Missing next draw');
  clock.advanceBy(250);
  const drawn = runtime.applyActions(
    next,
    draw.actions,
    scope.create(next, -2, clock),
  );
  expect(
    runtime.exposeStateForUser(drawn, 1, scope.create(drawn, 1, clock)),
  ).toMatchObject({
    kits: { quiz: { sessions: { [sessionId]: { phase: 'answering' } } } },
  });
});

it('keeps the deadline after the current bot answers and resolves human timeouts', async () => {
  const game = await testGame(definition)
    .players([{ username: 'Bot', isBot: true }, 'Human'])
    .start();
  await game.as(2).do('game.configure', document.simultaneousQuiz.defaults);
  await game.as(-1).do('draw', {});
  await game.as(-1).do('answer', { answerIndex: 0 });
  const { resolve, clock, scope } = automation();
  const state = game.state();
  const plan = resolve(state);
  expect(plan).toMatchObject({
    dueAtMs: clock.nowMs() + 30000,
    actions: [{ type: 'timeout' }],
  });
  if (!plan) throw new Error('Missing timeout');
  clock.advanceBy(30000);
  const next = runtime.applyActions(
    state,
    plan.actions,
    scope.create(state, -1, clock),
  );
  expect(
    runtime.exposeStateForUser(next, 2, scope.create(next, 2, clock)),
  ).toMatchObject({
    kits: { quiz: { sessions: { [sessionId]: { phase: 'closed' } } } },
  });
});

it('lets another bot answer after the current bot and prioritizes an earlier deadline', async () => {
  const game = await testGame(definition)
    .players([
      { username: 'Bot one', isBot: true },
      { username: 'Bot two', isBot: true },
      'Human',
    ])
    .start();
  await game.as(3).do('game.configure', document.simultaneousQuiz.defaults);
  await game.as(-1).do('draw', {});
  await game.as(-1).do('answer', { answerIndex: 0 });
  const { resolve, clock } = automation();
  expect(resolve(game.state())).toMatchObject({
    actions: [{ type: 'answer', meta: { actorId: -2 } }],
  });
  clock.advanceBy(29500);
  expect(resolve(game.state())).toMatchObject({
    actions: [{ type: 'timeout' }],
  });
});
