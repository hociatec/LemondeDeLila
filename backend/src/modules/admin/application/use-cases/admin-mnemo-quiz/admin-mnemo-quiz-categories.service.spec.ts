import { AdminMnemoQuizCategoriesService } from './admin-mnemo-quiz-categories.service';

describe('AdminMnemoQuizCategoriesService', () => {
  it('lists, creates, renames and deletes categories through the store', () => {
    const categories = [{ id: 'music', name: 'Musique' }];
    const store = {
      listCategories: jest.fn(() => categories),
      createCategory: jest.fn(),
      renameCategory: jest.fn(),
      deleteCategory: jest.fn(),
    };
    const service = new AdminMnemoQuizCategoriesService(store as never);

    expect(service.list()).toEqual(categories);
    service.create('Histoire');
    service.update('music', 'Musiques de Noël');
    service.delete('music');

    expect(store.createCategory).toHaveBeenCalledWith('Histoire');
    expect(store.renameCategory).toHaveBeenCalledWith(
      'music',
      'Musiques de Noël',
    );
    expect(store.deleteCategory).toHaveBeenCalledWith('music');
  });
});
