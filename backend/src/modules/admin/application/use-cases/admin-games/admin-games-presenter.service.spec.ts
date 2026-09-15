import { AdminGamesPresenterService } from './admin-games-presenter.service';

describe('AdminGamesPresenterService', () => {
  it('resolves category lists before building the payload', async () => {
    const categories = {
      getCategories: jest
        .fn()
        .mockResolvedValue([
          { id: 'party', name: 'Jeux de fête', parentId: null },
        ]),
      listAssignments: jest
        .fn()
        .mockResolvedValue([{ gameType: 'quiz', categoryId: 'party' }]),
    };
    const service = new AdminGamesPresenterService(
      { listGames: jest.fn() } as any,
      { getGameOverride: jest.fn() } as any,
      categories as any,
    );

    await expect(service.buildCategoriesPayload()).resolves.toEqual({
      categories: [{ id: 'party', name: 'Jeux de fête', parentId: null }],
      assignments: [{ gameType: 'quiz', categoryId: 'party' }],
    });
  });

  it('resolves assignments once when presenting all games', async () => {
    const categories = {
      listAssignments: jest
        .fn()
        .mockResolvedValue([{ gameType: 'quiz', categoryId: 'party' }]),
    };
    const service = new AdminGamesPresenterService(
      {
        listGames: jest.fn().mockResolvedValue([
          {
            id: 'quiz',
            name: 'Quiz',
            category: 'Jeux',
            subcategory: '',
            description: 'Questions',
            minPlayers: 2,
            maxPlayers: 8,
          },
        ]),
      } as any,
      { getGameOverride: jest.fn() } as any,
      categories as any,
    );

    await expect(service.buildGamesPayload()).resolves.toEqual({
      games: [expect.objectContaining({ id: 'quiz', categoryId: 'party' })],
    });
    expect(categories.listAssignments).toHaveBeenCalledTimes(1);
  });
});
