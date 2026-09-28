import { legacyExtensionFixture } from '../../../engine/testing/public-api';
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

const manifest = {
  code: 'simultaneous-quiz-automation',
  name: 'Quiz automatique',
  minPlayers: 2,
  maxPlayers: 8,
  engine: 'simultaneous-quiz-automation',
};
const documentExtensionSource = {
  schemaVersion: 1,
  contentVersion: '1',
  definitionVersion: '1',
  category: 'Tests',
  world: 'Tests',
  patterns: [],
  components: [],
  setup: {},
  resourceIds: [],
  shortcuts: [],
  initialPhase: 'setup',
  phases: {
    setup: { actions: [], transitions: ['playing'] },
    playing: { actions: ['answer', 'timeout', 'ready'], terminal: true },
  },
  actions: {
    answer: { recipe: 'choice-simultaneous-quiz-answer' },
    timeout: { recipe: 'choice-simultaneous-quiz-timeout' },
    ready: { recipe: 'choice-simultaneous-quiz-ready' },
  },
  victory: { kind: 'by-simultaneous-quiz' },
  extensions: [
    {
      type: 'simultaneousQuiz',
      config: {
        categories: { $content: 'content/quiz.json#/categories' },
        questions: { $content: 'content/quiz.json#/questions' },
        defaults: {
          categoryId: 'all',
          questionsPerRound: 5,
          targetPoints: 20,
          useTimer: true,
          timerSeconds: 30,
          interQuestionSeconds: 0,
          correctSoloPoints: 2,
          correctMultiPoints: 1,
          wrongPoints: 0,
          timeoutPoints: -1,
        },
      },
    },
  ],
};
const quiz = {
  categories: [{ id: 'test', name: 'Test' }],
  questions: Array.from({ length: 5 }, (_, index) => ({
    id: `question-${index}`,
    categoryId: 'test',
    question: `Question ${index}`,
    correct: 'Bonne réponse',
    wrong1: 'Réponse 1',
    wrong2: 'Réponse 2',
    wrong3: 'Réponse 3',
    status: 'validated',
  })),
};
const document = legacyExtensionFixture(
  documentExtensionSource,
  'simultaneousQuiz',
);

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

it('schedules a bot answer for the question started automatically', async () => {
  const game = await testGame(definition)
    .players(['Human', { username: 'Bot', isBot: true }])
    .start();
  await game.as(1).do('game.configure', document.simultaneousQuiz.defaults);
  await game.as(1).do('answer', { answerIndex: 0 });
  await game.as(-2).do('answer', { answerIndex: 0 });
  const { resolve, clock, scope } = automation();
  const state = game.state();
  const answer = resolve(state);
  expect(answer).toMatchObject({
    dueAtMs: clock.nowMs() + 1000,
    actions: [{ type: 'answer', meta: { actorId: -2 } }],
  });
  if (!answer) throw new Error('Missing bot answer');
  clock.advanceBy(1000);
  const next = runtime.applyActions(
    state,
    answer.actions,
    scope.create(state, -2, clock),
  );
  expect(
    runtime.exposeStateForUser(next, 1, scope.create(next, 1, clock)),
  ).toMatchObject({
    kits: { quiz: { sessions: { [sessionId]: { phase: 'answering' } } } },
  });
});

it('keeps the deadline after the current bot answers and resolves human timeouts', async () => {
  const game = await testGame(definition)
    .players([{ username: 'Bot', isBot: true }, 'Human'])
    .start();
  await game.as(2).do('game.configure', document.simultaneousQuiz.defaults);
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
    kits: { quiz: { sessions: { [sessionId]: { phase: 'answering' } } } },
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
