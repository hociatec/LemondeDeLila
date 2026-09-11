import { MoreThan } from 'typeorm';
import { GameCatalogOverridesTypeormRepository } from './game-catalog-overrides-typeorm.repository';

it('returns every catalog page in key order without exposing entity fields', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    gameType: `game-${String(index).padStart(3, '0')}`,
    enabled: true,
    internal: 'private',
  }));
  const find = jest
    .fn()
    .mockResolvedValueOnce(firstPage)
    .mockResolvedValueOnce([{ gameType: 'game-100', enabled: false }]);
  const repository = new GameCatalogOverridesTypeormRepository({
    find,
  } as never);

  const result = await repository.findAll();

  expect(result).toHaveLength(101);
  expect(result.map((entry) => entry.gameType)).toEqual([
    ...firstPage.map((entry) => entry.gameType),
    'game-100',
  ]);
  expect(result[0]).toEqual({
    gameType: 'game-000',
    override: expect.objectContaining({ enabled: true }),
  });
  expect(result[0].override).not.toHaveProperty('internal');
  expect(find).toHaveBeenNthCalledWith(1, {
    where: {},
    order: { gameType: 'ASC' },
    take: 100,
  });
  expect(find).toHaveBeenNthCalledWith(2, {
    where: { gameType: MoreThan('game-099') },
    order: { gameType: 'ASC' },
    take: 100,
  });
});
