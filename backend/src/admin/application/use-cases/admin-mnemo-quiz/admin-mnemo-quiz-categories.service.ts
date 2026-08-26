import { Inject, Injectable } from '@nestjs/common';
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
    this.store.createCategory(name);
  }

  update(id: string, name: string) {
    this.store.renameCategory(id, name);
  }

  delete(id: string) {
    this.store.deleteCategory(id);
  }
}
