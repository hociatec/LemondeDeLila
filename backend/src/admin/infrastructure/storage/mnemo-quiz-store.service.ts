import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { readEnvironment } from '../../../config/public-api';
import type {
  MnemoQuestionStatus,
  MnemoQuizCategory,
  MnemoQuizQuestion,
  MnemoQuizStoreData,
} from '../../domain/models/mnemo-quiz.model';
import type {
  AdminMnemoQuizStorePort,
  MnemoQuestionInput,
  MnemoQuestionPatch,
} from '../../application/ports/admin-mnemo-quiz-store.port';

@Injectable()
export class MnemoQuizStoreService
  implements OnModuleInit, AdminMnemoQuizStorePort
{
  private readonly filePath = resolveStoragePath();
  private data: MnemoQuizStoreData = { categories: [], questions: [] };

  onModuleInit(): void {
    this.load();
  }

  getSnapshot(): MnemoQuizStoreData {
    return structuredClone(this.data);
  }

  listCategories(): MnemoQuizCategory[] {
    return this.getSnapshot().categories.sort((left, right) =>
      left.name.localeCompare(right.name, 'fr'),
    );
  }

  listQuestions(
    filter: {
      categoryId?: string;
      status?: MnemoQuestionStatus;
    } = {},
  ): MnemoQuizQuestion[] {
    return this.getSnapshot()
      .questions.filter(
        (question) =>
          (!filter.categoryId || question.categoryId === filter.categoryId) &&
          (!filter.status || question.status === filter.status),
      )
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }

  createCategory(name: string): MnemoQuizCategory {
    const normalized = requireText(name, 'Nom de catégorie requis');
    const category = {
      id: this.uniqueCategoryId(slugify(normalized)),
      name: normalized,
    };
    this.data.categories.push(category);
    this.persist();
    return structuredClone(category);
  }

  renameCategory(categoryId: string, name: string): MnemoQuizCategory {
    const category = this.requireCategory(categoryId);
    category.name = requireText(name, 'Nom de catégorie requis');
    this.persist();
    return structuredClone(category);
  }

  deleteCategory(categoryId: string): void {
    const category = this.requireCategory(categoryId);
    this.data.categories = this.data.categories.filter(
      (candidate) => candidate.id !== category.id,
    );
    const now = new Date().toISOString();
    for (const question of this.data.questions) {
      if (question.categoryId === category.id) {
        question.status = 'trash';
        question.updatedAt = now;
      }
    }
    this.persist();
  }

  createQuestion(input: MnemoQuestionInput): MnemoQuizQuestion {
    this.requireCategory(input.categoryId);
    const now = new Date().toISOString();
    const question: MnemoQuizQuestion = {
      id: randomUUID(),
      categoryId: input.categoryId,
      question: requireText(input.question, 'Question requise'),
      correct: requireText(input.correct, 'Bonne réponse requise'),
      wrong1: requireText(input.wrong1, 'Trois mauvaises réponses requises'),
      wrong2: requireText(input.wrong2, 'Trois mauvaises réponses requises'),
      wrong3: requireText(input.wrong3, 'Trois mauvaises réponses requises'),
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    this.data.questions.push(question);
    this.persist();
    return structuredClone(question);
  }

  updateQuestion(
    questionId: string,
    patch: MnemoQuestionPatch,
  ): MnemoQuizQuestion {
    const question = this.requireQuestion(questionId);
    if (patch.categoryId !== undefined) {
      this.requireCategory(patch.categoryId);
      question.categoryId = patch.categoryId;
    }
    if (patch.question !== undefined)
      question.question = requireText(patch.question, 'Question requise');
    if (patch.correct !== undefined)
      question.correct = requireText(patch.correct, 'Bonne réponse requise');
    if (patch.wrong1 !== undefined)
      question.wrong1 = requireText(patch.wrong1, 'Mauvaise réponse requise');
    if (patch.wrong2 !== undefined)
      question.wrong2 = requireText(patch.wrong2, 'Mauvaise réponse requise');
    if (patch.wrong3 !== undefined)
      question.wrong3 = requireText(patch.wrong3, 'Mauvaise réponse requise');
    if (patch.status !== undefined) question.status = patch.status;
    question.updatedAt = new Date().toISOString();
    this.persist();
    return structuredClone(question);
  }

  deleteQuestion(questionId: string): void {
    const question = this.requireQuestion(questionId);
    this.data.questions = this.data.questions.filter(
      (candidate) => candidate.id !== question.id,
    );
    this.persist();
  }

  private load(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.persist();
      return;
    }
    const source = fs
      .readFileSync(this.filePath, 'utf8')
      .replace(/^\uFEFF/, '');
    this.data = parseStoreData(source);
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(this.data, null, 2)}\n`,
      'utf8',
    );
    fs.renameSync(temporaryPath, this.filePath);
  }

  private requireCategory(categoryId: string): MnemoQuizCategory {
    const id = requireText(categoryId, 'Catégorie requise');
    const category = this.data.categories.find(
      (candidate) => candidate.id === id,
    );
    if (!category) throw new Error('Catégorie Mnémosyne introuvable');
    return category;
  }

  private requireQuestion(questionId: string): MnemoQuizQuestion {
    const id = requireText(questionId, 'Question requise');
    const question = this.data.questions.find(
      (candidate) => candidate.id === id,
    );
    if (!question) throw new Error('Question Mnémosyne introuvable');
    return question;
  }

  private uniqueCategoryId(base: string): string {
    if (!base) throw new Error('Identifiant de catégorie invalide');
    let candidate = base;
    let suffix = 1;
    while (this.data.categories.some((category) => category.id === candidate))
      candidate = `${base}-${suffix++}`;
    return candidate;
  }
}

function resolveStoragePath(): string {
  const configured = readEnvironment('MNEMO_QUIZ_PATH').trim();
  if (configured) return path.resolve(configured);
  const projectData = path.resolve(
    process.cwd(),
    'src/game/games/vents-infinis/arche-de-mnemosyne/quiz.json',
  );
  if (readEnvironment('NODE_ENV').toLowerCase() !== 'production')
    return projectData;
  const persistent = path.join(
    os.homedir(),
    '.local',
    'share',
    'lemonde-de-lila',
    'arche-de-mnemosyne',
    'quiz.json',
  );
  if (!fs.existsSync(persistent) && fs.existsSync(projectData)) {
    fs.mkdirSync(path.dirname(persistent), { recursive: true });
    fs.copyFileSync(projectData, persistent);
  }
  return persistent;
}

function parseStoreData(source: string): MnemoQuizStoreData {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) throw new Error('Catalogue Mnémosyne invalide');
  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.filter(isCategory)
    : [];
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter(isQuestion)
    : [];
  return { categories, questions };
}

function isCategory(value: unknown): value is MnemoQuizCategory {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  );
}

function isQuestion(value: unknown): value is MnemoQuizQuestion {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.question === 'string' &&
    typeof value.correct === 'string' &&
    typeof value.wrong1 === 'string' &&
    typeof value.wrong2 === 'string' &&
    typeof value.wrong3 === 'string' &&
    isStatus(value.status) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isStatus(value: unknown): value is MnemoQuestionStatus {
  return (
    value === 'validated' ||
    value === 'pending' ||
    value === 'to_edit' ||
    value === 'trash'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
