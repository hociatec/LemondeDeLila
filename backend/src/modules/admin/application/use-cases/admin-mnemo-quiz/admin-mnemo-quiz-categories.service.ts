import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MNEMO_QUIZ_STORE_PORT,
  type AdminMnemoQuizStorePort,
} from '../../ports/admin-mnemo-quiz-store.port';

@Injectable()
export class AdminMnemoQuizCategoriesService {
  constructor(
    @Inject(ADMIN_MNEMO_QUIZ_STORE_PORT)
    private readonly store: AdminMnemoQuizStorePort,
  ) {}

  list() {
    return this.store.listCategories();
  }

  create(name: string) {
    assertCategoryName(name);
    this.store.createCategory(name);
  }

  update(id: string, name: string) {
    assertCategoryId(id);
    assertCategoryName(name);
    this.store.renameCategory(id, name);
  }

  delete(id: string) {
    assertCategoryId(id);
    this.store.deleteCategory(id);
  }
}

function assertCategoryId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    throw new BadRequestException('Identifiant de catégorie invalide.');
  }
}

function assertCategoryName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 255) {
    throw new BadRequestException('Nom de catégorie invalide.');
  }
}
