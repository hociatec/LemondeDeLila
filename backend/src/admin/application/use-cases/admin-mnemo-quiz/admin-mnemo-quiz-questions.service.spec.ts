import { AdminMnemoQuizQuestionsService } from './admin-mnemo-quiz-questions.service';

describe('AdminMnemoQuizQuestionsService', () => {
  function createStoreMock() {
    return {
      listQuestions: jest.fn(),
      createQuestion: jest.fn(),
      updateQuestion: jest.fn(),
      deleteQuestion: jest.fn(),
    } as any;
  }

  it('maps answers and correct index when creating a question', () => {
    const store = createStoreMock();
    const service = new AdminMnemoQuizQuestionsService(store);

    service.create({
      categoryId: 'c1',
      question: 'Question ?',
      answers: ['Bonne', 'Mauvaise 1', 'Mauvaise 2', 'Mauvaise 3'],
      correctIndex: 0,
      status: 'validated',
    });

    expect(store.createQuestion).toHaveBeenCalledWith({
      categoryId: 'c1',
      question: 'Question ?',
      correct: 'Bonne',
      wrong1: 'Mauvaise 1',
      wrong2: 'Mauvaise 2',
      wrong3: 'Mauvaise 3',
      status: 'validated',
    });
  });

  it('rebuilds answers correctly when updating the correct index', () => {
    const store = createStoreMock();
    store.listQuestions.mockReturnValue([
      {
        id: 'q1',
        categoryId: 'c1',
        question: 'Question ?',
        correct: 'Bonne',
        wrong1: 'Mauvaise 1',
        wrong2: 'Mauvaise 2',
        wrong3: 'Mauvaise 3',
        status: 'validated',
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z',
      },
    ]);
    const service = new AdminMnemoQuizQuestionsService(store);

    service.update({
      id: 'q1',
      answers: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
    });

    expect(store.updateQuestion).toHaveBeenCalledWith(
      'q1',
      expect.objectContaining({
        correct: 'C',
        wrong1: 'A',
        wrong2: 'B',
        wrong3: 'D',
      }),
    );
  });
});
