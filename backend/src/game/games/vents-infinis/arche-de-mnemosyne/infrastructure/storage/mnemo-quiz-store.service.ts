import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  MnemoQuizAnswerSetRequiredError,
  MnemoQuizCategoryNameRequiredError,
  MnemoQuizCategoryNotFoundError,
  MnemoQuizCategoryRequiredError,
  MnemoQuizCorrectAnswerRequiredError,
  MnemoQuizInvalidIdentifierError,
  MnemoQuizQuestionNotFoundError,
  MnemoQuizQuestionRequiredError,
} from '../../../../../domain/errors/game-domain.errors';
import type {
  MnemoQuestionStatus,
  MnemoQuizCategory,
  MnemoQuizQuestion,
  MnemoQuizStoreData,
} from '../../model/mnemo-quiz.model';

export class MnemoQuizStoreService {
  private filePath: string;
  private data: MnemoQuizStoreData = { categories: [], questions: [] };

  constructor() {
    this.filePath = this.resolveStoragePath();
  }

  private resolveStoragePath(): string {
    const envPath = String(process.env.MNEMO_QUIZ_PATH ?? '').trim();
    if (envPath) {
      return path.resolve(envPath);
    }

    const legacyPath = path.resolve(
      process.cwd(),
      'data',
      'arche-de-mnemosyne',
      'quiz.json',
    );
    const nodeEnv = String(process.env.NODE_ENV ?? '')
      .trim()
      .toLowerCase();

    if (nodeEnv !== 'production') {
      return legacyPath;
    }

    const persistentPath = path.join(
      os.homedir(),
      '.local',
      'share',
      'lemonde-de-lila',
      'arche-de-mnemosyne',
      'quiz.json',
    );
    this.bootstrapPersistentStorage(legacyPath, persistentPath);
    return persistentPath;
  }

  private bootstrapPersistentStorage(
    legacyPath: string,
    persistentPath: string,
  ): void {
    if (path.resolve(legacyPath) === path.resolve(persistentPath)) {
      return;
    }

    try {
      if (!fs.existsSync(legacyPath) || fs.existsSync(persistentPath)) {
        return;
      }

      fs.mkdirSync(path.dirname(persistentPath), { recursive: true });
      fs.copyFileSync(legacyPath, persistentPath);
    } catch {
      // best-effort: if bootstrap fails, we continue with the persistent path;
      // admin can re-enter content without blocking startup.
    }
  }

  onModuleInit(): void {
    this.ensureLoaded();
  }

  getSnapshot(): MnemoQuizStoreData {
    this.ensureLoaded();
    return {
      categories: [...this.data.categories],
      questions: [...this.data.questions],
    };
  }

  listCategories(): MnemoQuizCategory[] {
    return [...this.getSnapshot().categories].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr'),
    );
  }

  listQuestions(filter?: {
    categoryId?: string;
    status?: MnemoQuestionStatus;
  }): MnemoQuizQuestion[] {
    const snap = this.getSnapshot();
    let items = [...snap.questions];
    if (filter?.categoryId) {
      items = items.filter((q) => q.categoryId === filter.categoryId);
    }
    if (filter?.status) {
      items = items.filter((q) => q.status === filter.status);
    }
    return items.sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt));
  }

  createCategory(name: string): MnemoQuizCategory {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) {
      throw new MnemoQuizCategoryNameRequiredError();
    }
    const id = this.ensureUniqueId(this.slugify(trimmed));
    const category: MnemoQuizCategory = { id, name: trimmed };
    this.data.categories.push(category);
    this.persist();
    return category;
  }

  renameCategory(categoryId: string, name: string): MnemoQuizCategory {
    const id = String(categoryId ?? '').trim();
    const trimmed = String(name ?? '').trim();
    if (!id) throw new MnemoQuizCategoryRequiredError();
    if (!trimmed) throw new MnemoQuizCategoryNameRequiredError('Nom requis');

    const category = this.data.categories.find((c) => c.id === id);
    if (!category) {
      throw new MnemoQuizCategoryNotFoundError();
    }
    category.name = trimmed;
    this.persist();
    return category;
  }

  deleteCategory(categoryId: string): void {
    const id = String(categoryId ?? '').trim();
    if (!id) throw new MnemoQuizCategoryRequiredError();
    const before = this.data.categories.length;
    this.data.categories = this.data.categories.filter((c) => c.id !== id);
    if (this.data.categories.length === before) {
      throw new MnemoQuizCategoryNotFoundError();
    }
    // Best-effort: mettre les questions en corbeille si la catégorie disparaît.
    for (const q of this.data.questions) {
      if (q.categoryId === id) {
        q.status = 'trash';
        q.updatedAt = new Date().toISOString();
      }
    }
    this.persist();
  }

  createQuestion(input: {
    categoryId: string;
    question: string;
    correct: string;
    wrong1: string;
    wrong2: string;
    wrong3: string;
    status?: MnemoQuestionStatus;
  }): MnemoQuizQuestion {
    const categoryId = String(input.categoryId ?? '').trim();
    if (!categoryId) throw new MnemoQuizCategoryRequiredError();
    if (!this.data.categories.some((c) => c.id === categoryId)) {
      throw new MnemoQuizCategoryNotFoundError();
    }

    const now = new Date().toISOString();
    const entity: MnemoQuizQuestion = {
      id: randomUUID(),
      categoryId,
      question: String(input.question ?? '').trim(),
      correct: String(input.correct ?? '').trim(),
      wrong1: String(input.wrong1 ?? '').trim(),
      wrong2: String(input.wrong2 ?? '').trim(),
      wrong3: String(input.wrong3 ?? '').trim(),
      status: input.status ?? 'validated',
      createdAt: now,
      updatedAt: now,
    };
    if (!entity.question) throw new MnemoQuizQuestionRequiredError();
    if (!entity.correct) throw new MnemoQuizCorrectAnswerRequiredError();
    if (!entity.wrong1 || !entity.wrong2 || !entity.wrong3) {
      throw new MnemoQuizAnswerSetRequiredError();
    }

    this.data.questions.push(entity);
    this.persist();
    return entity;
  }

  updateQuestion(
    questionId: string,
    patch: Partial<
      Pick<
        MnemoQuizQuestion,
        'question' | 'correct' | 'wrong1' | 'wrong2' | 'wrong3' | 'status'
      >
    >,
  ): MnemoQuizQuestion {
    const id = String(questionId ?? '').trim();
    if (!id) throw new MnemoQuizQuestionRequiredError();
    const q = this.data.questions.find((x) => x.id === id);
    if (!q) throw new MnemoQuizQuestionNotFoundError();

    if (patch.question !== undefined)
      q.question = String(patch.question).trim();
    if (patch.correct !== undefined) q.correct = String(patch.correct).trim();
    if (patch.wrong1 !== undefined) q.wrong1 = String(patch.wrong1).trim();
    if (patch.wrong2 !== undefined) q.wrong2 = String(patch.wrong2).trim();
    if (patch.wrong3 !== undefined) q.wrong3 = String(patch.wrong3).trim();
    if (patch.status !== undefined) q.status = patch.status;
    q.updatedAt = new Date().toISOString();

    if (!q.question) throw new MnemoQuizQuestionRequiredError();
    if (!q.correct) throw new MnemoQuizCorrectAnswerRequiredError();
    if (!q.wrong1 || !q.wrong2 || !q.wrong3) {
      throw new MnemoQuizAnswerSetRequiredError();
    }

    this.persist();
    return q;
  }

  deleteQuestion(questionId: string): void {
    const id = String(questionId ?? '').trim();
    if (!id) throw new MnemoQuizQuestionRequiredError();
    const before = this.data.questions.length;
    this.data.questions = this.data.questions.filter((x) => x.id !== id);
    if (this.data.questions.length === before) {
      throw new MnemoQuizQuestionNotFoundError();
    }
    this.persist();
  }

  private ensureLoaded(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        this.data = { categories: [], questions: [] };
        this.persist();
        return;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(
        raw.replace(/^\uFEFF/, ''),
      ) as MnemoQuizStoreData;
      const categories = Array.isArray(parsed?.categories)
        ? parsed.categories
        : [];
      const questions = Array.isArray(parsed?.questions)
        ? parsed.questions
        : [];
      this.data = { categories, questions };
    } catch (err) {
      console.warn(
        `[MnemoQuizStoreService] Impossible de charger ${this.filePath}: ${(err as Error).message}`,
      );
      this.data = { categories: [], questions: [] };
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  private ensureUniqueId(base: string): string {
    const clean = String(base ?? '').trim();
    if (!clean) throw new MnemoQuizInvalidIdentifierError();
    let candidate = clean;
    let attempt = 1;
    while (this.data.categories.some((c) => c.id === candidate)) {
      candidate = `${clean}-${attempt++}`;
    }
    return candidate;
  }

  private slugify(value: string): string {
    const normalized = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
}
