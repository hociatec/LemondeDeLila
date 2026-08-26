import { AdminRolesService } from './admin-roles.service';

describe('AdminRolesService', () => {
  it('returns roles and definitions for listing', async () => {
    const roleDefinitions = {
      list: jest.fn().mockResolvedValue([
        { name: 'ROLE_ADMIN', description: 'admin', permissions: ['admin.*'] },
        { name: 'ROLE_USER', description: 'user', permissions: ['play'] },
      ]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const service = new AdminRolesService(
      roleDefinitions as any,
      {
        notifyCatalogInvalidated: jest.fn(),
      } as any,
    );

    await expect(service.list()).resolves.toEqual({
      roles: ['ROLE_ADMIN', 'ROLE_USER'],
      definitions: [
        { name: 'ROLE_ADMIN', description: 'admin', permissions: ['admin.*'] },
        { name: 'ROLE_USER', description: 'user', permissions: ['play'] },
      ],
    });
  });

  it('creates a role and notifies catalog invalidation', async () => {
    const roleDefinitions = {
      list: jest
        .fn()
        .mockResolvedValue([
          { name: 'ROLE_EDITOR', description: 'editor', permissions: ['x'] },
        ]),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const notifyCatalogInvalidated = jest.fn().mockResolvedValue(undefined);
    const service = new AdminRolesService(
      roleDefinitions as any,
      {
        notifyCatalogInvalidated,
      } as any,
    );

    await expect(
      service.create(7, {
        name: 'ROLE_EDITOR',
        description: 'editor',
        permissions: ['x'],
      }),
    ).resolves.toEqual({
      definitions: [
        { name: 'ROLE_EDITOR', description: 'editor', permissions: ['x'] },
      ],
    });

    expect(roleDefinitions.create).toHaveBeenCalledWith({
      name: 'ROLE_EDITOR',
      description: 'editor',
      permissions: ['x'],
    });
    expect(notifyCatalogInvalidated).toHaveBeenCalledWith(7);
  });

  it('updates and deletes through role definitions service', async () => {
    const roleDefinitions = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const notifyCatalogInvalidated = jest.fn().mockResolvedValue(undefined);
    const service = new AdminRolesService(
      roleDefinitions as any,
      {
        notifyCatalogInvalidated,
      } as any,
    );

    await service.update(9, {
      name: 'ROLE_USER',
      newName: 'ROLE_MEMBER',
      description: 'member',
      permissions: ['read'],
    });
    await service.delete(9, 'ROLE_MEMBER');

    expect(roleDefinitions.update).toHaveBeenCalledWith('ROLE_USER', {
      name: 'ROLE_MEMBER',
      description: 'member',
      permissions: ['read'],
    });
    expect(roleDefinitions.delete).toHaveBeenCalledWith('ROLE_MEMBER');
    expect(notifyCatalogInvalidated).toHaveBeenCalledTimes(2);
  });
});
