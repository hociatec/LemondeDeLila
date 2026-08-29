import { AdminRoleDefinitionsCatalogService } from '../use-cases/admin-roles/admin-role-definitions-catalog.service';

describe('AdminRoleDefinitionsCatalogService', () => {
  function createRepositoryMock() {
    return {
      findAll: jest.fn(),
      findByName: jest.fn(),
      count: jest.fn(),
      insert: jest.fn(async () => undefined),
      saveMany: jest.fn(async () => undefined),
      update: jest.fn(async () => undefined),
      delete: jest.fn(async () => true),
    } as any;
  }

  it('seeds default definitions when storage is empty', async () => {
    const repo = createRepositoryMock();
    repo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    repo.findAll.mockResolvedValueOnce([
      {
        name: 'ROLE_USER',
        description: 'user',
        permissions: ['game.play'],
      },
    ]);
    const service = new AdminRoleDefinitionsCatalogService(repo);

    await service.onModuleInit();
    await service.list();

    expect(repo.saveMany).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate role creation', async () => {
    const repo = createRepositoryMock();
    repo.count.mockResolvedValue(1);
    repo.findAll.mockResolvedValue([
      {
        name: 'ROLE_ADMIN',
        description: 'admin',
        permissions: ['admin.*'],
      },
    ]);
    const service = new AdminRoleDefinitionsCatalogService(repo);

    await expect(
      service.create({
        name: 'ROLE_ADMIN',
        description: 'duplicate',
        permissions: [],
      }),
    ).rejects.toThrow(/existe deja/i);
  });

  it('rejects update when target renamed role already exists', async () => {
    const repo = createRepositoryMock();
    repo.count.mockResolvedValue(1);
    repo.findByName.mockResolvedValueOnce({
      name: 'ROLE_MODERATOR',
      description: 'moderator',
      permissions: ['admin.users'],
    });
    repo.findByName.mockResolvedValueOnce({
      name: 'ROLE_ADMIN',
      description: 'admin',
      permissions: ['admin.*'],
    });
    const service = new AdminRoleDefinitionsCatalogService(repo);

    await expect(
      service.update('ROLE_MODERATOR', { name: 'ROLE_ADMIN' }),
    ).rejects.toThrow(/existe deja/i);
  });
});
