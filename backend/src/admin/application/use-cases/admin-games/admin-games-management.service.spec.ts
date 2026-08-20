import { AdminGamesManagementService } from './admin-games-management.service';

describe('AdminGamesManagementService', () => {
  it('creates a category and invalidates the catalog', async () => {
    const deps = createDeps();
    deps.presenter.buildCategoriesPayload.mockResolvedValue({ items: ['arcade'] });

    const service = new AdminGamesManagementService(
      deps.presenter as any,
      deps.categories as any,
      deps.overrides as any,
      deps.catalogInvalidation as any,
    );

    await expect(
      service.createCategory(7, { name: 'Arcade', parentId: null }),
    ).resolves.toEqual({ items: ['arcade'] });

    expect(deps.categories.create).toHaveBeenCalledWith('Arcade', null);
    expect(
      deps.catalogInvalidation.invalidateCatalogAndNotify,
    ).toHaveBeenCalledWith(7);
  });

  it('updates a game override and acknowledges success', async () => {
    const deps = createDeps();
    const service = new AdminGamesManagementService(
      deps.presenter as any,
      deps.categories as any,
      deps.overrides as any,
      deps.catalogInvalidation as any,
    );

    await expect(
      service.updateGame(4, { gameType: 'quiz', enabled: true }),
    ).resolves.toEqual({ ok: true });

    expect(deps.overrides.update).toHaveBeenCalledWith({
      gameType: 'quiz',
      enabled: true,
    });
    expect(
      deps.catalogInvalidation.invalidateCatalogAndNotify,
    ).toHaveBeenCalledWith(4);
  });

  it('assigns categories and reuses presenter payload', async () => {
    const deps = createDeps();
    deps.presenter.buildCategoriesPayload.mockResolvedValue({ items: [] });

    const service = new AdminGamesManagementService(
      deps.presenter as any,
      deps.categories as any,
      deps.overrides as any,
      deps.catalogInvalidation as any,
    );

    await expect(
      service.assignCategory(3, { gameType: 'quiz', categoryId: 'cat-1' }),
    ).resolves.toEqual({ items: [] });

    expect(deps.categories.assign).toHaveBeenCalledWith('quiz', 'cat-1');
  });
});

function createDeps() {
  return {
    presenter: {
      buildGamesPayload: jest.fn(),
      buildCategoriesPayload: jest.fn(),
    },
    categories: {
      create: jest.fn(),
      update: jest.fn(),
      assign: jest.fn(),
      delete: jest.fn(),
    },
    overrides: {
      setEnabled: jest.fn(),
      update: jest.fn(),
      reset: jest.fn(),
    },
    catalogInvalidation: {
      invalidateCatalogAndNotify: jest.fn(),
    },
  };
}
