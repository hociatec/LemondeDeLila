import { stringifyExternalJson } from '../../../../../platform/serialization/public-api';
import { AdminMnemoQuizPresenterService } from './admin-mnemo-quiz-presenter.service';

describe('AdminMnemoQuizPresenterService', () => {
  it('paginates large question catalogs into a bounded WebSocket payload', () => {
    const questions = Array.from({ length: 1_818 }, (_, index) => ({
      id: `question-${index}`,
      categoryId: 'general',
      question: `Question ${index}`,
      correct: 'Correcte',
      wrong1: 'Erreur 1',
      wrong2: 'Erreur 2',
      wrong3: 'Erreur 3',
      status: 'validated' as const,
      createdAt: '2026-09-15T10:00:00.000Z',
      updatedAt: '2026-09-15T10:00:00.000Z',
    }));
    const store = {
      listQuestions: jest.fn(() => questions),
    };
    const presenter = new AdminMnemoQuizPresenterService(store as never);

    const payload = presenter.buildQuestionsPayload({ offset: 100, limit: 50 });

    expect(payload).toMatchObject({ total: 1_818, offset: 100, limit: 50 });
    expect(payload.questions).toHaveLength(50);
    expect(payload.questions[0]?.id).toBe('question-100');
    expect(() =>
      stringifyExternalJson({ type: 'admin.quiz.mnemo.questions', payload }),
    ).not.toThrow();
  });

  it('uses safe pagination defaults', () => {
    const store = {
      listQuestions: jest.fn(() => []),
    };
    const presenter = new AdminMnemoQuizPresenterService(store as never);

    expect(presenter.buildQuestionsPayload()).toEqual({
      questions: [],
      total: 0,
      offset: 0,
      limit: 50,
    });
  });
});
