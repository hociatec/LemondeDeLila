import { StateGameRng } from '../../../core/application/models/game-execution-context.model';
import { createQuizKitState, GameQuizController, quiz } from './quiz-kit';
import { projectGameKits } from '../projection/game-kit-view';

it('shuffles each repeat, persists the order, grades displayed answers and keeps the mapping private', () => {
  const state = createQuizKitState();
  const definition = quiz.bank({
    id: 'bank',
    repeat: true,
    shuffleChoices: true,
    scoring: { correct: 2 },
    questions: [
      {
        id: 'q',
        prompt: 'Question',
        choices: ['Correct', 'B', 'C', 'D'],
        answerIndex: 0,
      },
    ],
  });
  const random = new StateGameRng({
    status: 'started',
    phase: 'playing',
    log: [],
    metadata: { rng: { seed: 127, counter: 0 } },
  });
  const score = jest.fn();
  const controller = new GameQuizController(
    state,
    random,
    [definition],
    undefined,
    score,
  );
  controller.create(definition);
  const orders = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const session = controller.ask('bank', [1], { sessionId: 'round' });
    if (!session) throw new Error('Missing question');
    orders.add(JSON.stringify(session.question.choices));
    const saved = JSON.parse(JSON.stringify(state)) as typeof state;
    const restored = new GameQuizController(
      saved,
      random,
      [definition],
      undefined,
      score,
    );
    expect(restored.session('round')?.question).toEqual(session.question);
    const view = projectGameKits({ quiz: saved }, null, 0, [definition]);
    expect(view.quiz).toMatchObject({
      sessions: { round: { question: session.question } },
    });
    expect(JSON.stringify(view)).not.toMatch(
      /choiceOrder|correctAnswerIndex|answerIndex/,
    );
    const correctIndex = session.question.choices.indexOf('Correct');
    expect(restored.answer('round', 1, correctIndex)).toMatchObject({
      correct: true,
      revealed: true,
    });
    expect(restored.session('round')?.correctAnswerIndex).toBe(correctIndex);
    expect(score).toHaveBeenLastCalledWith(1, 2);
    controller.close('round');
  }
  expect(orders.size).toBeGreaterThan(4);
});

it('retains catalogue order for saved sessions without a shuffle mapping', () => {
  const state = createQuizKitState();
  const definition = quiz.bank({
    id: 'bank',
    shuffleChoices: true,
    questions: [
      { id: 'q', prompt: 'Question', choices: ['A', 'B'], answerIndex: 1 },
    ],
  });
  state.sessions.old = {
    id: 'old',
    bankId: 'bank',
    questionId: 'q',
    participantPlayerIds: [1],
    answers: {},
    phase: 'answering',
    scored: false,
  };
  const controller = new GameQuizController(state, {} as never, [definition]);
  expect(controller.session('old')?.question.choices).toEqual(['A', 'B']);
  expect(controller.answer('old', 1, 1).correct).toBe(true);
});
