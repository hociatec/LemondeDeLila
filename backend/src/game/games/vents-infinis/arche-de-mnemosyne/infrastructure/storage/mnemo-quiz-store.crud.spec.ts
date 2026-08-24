import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MnemoQuizStoreService } from './mnemo-quiz-store.service';

describe('MnemoQuizStoreService CRUD', () => {
  const originalPath = process.env.MNEMO_QUIZ_PATH;
  let tempRoot = '';
  let filePath = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mnemo-store-crud-'));
    filePath = path.join(tempRoot, 'quiz.json');
    process.env.MNEMO_QUIZ_PATH = filePath;
  });

  afterEach(() => {
    process.env.MNEMO_QUIZ_PATH = originalPath;
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('initializes empty storage and persists default file', () => {
    const store = new MnemoQuizStoreService();
    store.onModuleInit();
    expect(fs.existsSync(filePath)).toBe(true);
    expect(store.getSnapshot().categories).toEqual([]);
    expect(store.getSnapshot().questions).toEqual([]);
  });

  it('handles category lifecycle and unique slug generation', () => {
    const store = new MnemoQuizStoreService();
    store.onModuleInit();

    const a = store.createCategory('Histoire');
    const b = store.createCategory('Histoire');
    expect(a.id).toBe('histoire');
    expect(b.id).toBe('histoire-1');

    const renamed = store.renameCategory(a.id, 'Histoire Mondiale');
    expect(renamed.name).toBe('Histoire Mondiale');

    expect(() => store.renameCategory('missing', 'x')).toThrow();
    expect(() => store.deleteCategory('missing')).toThrow();
  });

  it('handles question lifecycle, filters and delete/trash behavior', () => {
    const store = new MnemoQuizStoreService();
    store.onModuleInit();
    const category = store.createCategory('Sciences');

    const q1 = store.createQuestion({
      categoryId: category.id,
      question: 'Q1',
      correct: 'A',
      wrong1: 'B',
      wrong2: 'C',
      wrong3: 'D',
      status: 'validated',
    });
    const q2 = store.createQuestion({
      categoryId: category.id,
      question: 'Q2',
      correct: 'A2',
      wrong1: 'B2',
      wrong2: 'C2',
      wrong3: 'D2',
      status: 'pending',
    });

    expect(store.listQuestions({ categoryId: category.id }).length).toBe(2);
    expect(
      store.listQuestions({ status: 'pending' }).map((q) => q.id),
    ).toContain(q2.id);

    const updated = store.updateQuestion(q1.id, {
      question: 'Q1 bis',
      status: 'to_edit',
    });
    expect(updated.question).toBe('Q1 bis');
    expect(updated.status).toBe('to_edit');

    expect(() => store.updateQuestion('missing', { question: 'x' })).toThrow();
    expect(() => store.deleteQuestion('missing')).toThrow();

    store.deleteQuestion(q2.id);
    expect(store.listQuestions().some((q) => q.id === q2.id)).toBe(false);

    store.deleteCategory(category.id);
    const trashed = store.listQuestions().find((q) => q.id === q1.id);
    expect(trashed?.status).toBe('trash');
  });

  it('rejects invalid payloads and recovers from corrupted json', () => {
    const store = new MnemoQuizStoreService();
    store.onModuleInit();
    const category = store.createCategory('Culture');

    expect(() => store.createCategory('')).toThrow();
    expect(() =>
      store.createQuestion({
        categoryId: '',
        question: 'Q',
        correct: 'A',
        wrong1: 'B',
        wrong2: 'C',
        wrong3: 'D',
      }),
    ).toThrow();
    expect(() =>
      store.createQuestion({
        categoryId: category.id,
        question: '',
        correct: 'A',
        wrong1: 'B',
        wrong2: 'C',
        wrong3: 'D',
      }),
    ).toThrow();

    fs.writeFileSync(filePath, '{invalid json', 'utf-8');
    const recovered = new MnemoQuizStoreService();
    recovered.onModuleInit();
    expect(recovered.getSnapshot().categories).toEqual([]);
  });
});
