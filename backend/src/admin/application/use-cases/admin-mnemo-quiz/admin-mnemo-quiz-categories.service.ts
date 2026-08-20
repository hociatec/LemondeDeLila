import { Injectable } from '@nestjs/common';
import { MnemoQuizStoreService } from '../../../../game/games/vents-infinis/arche-de-mnemosyne/store/mnemo-quiz-store.service';

@Injectable()
export class AdminMnemoQuizCategoriesService {
  constructor(private readonly store: MnemoQuizStoreService) {}

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
