import { AdminUserRolesUpdateService } from '../use-cases/admin-users/admin-user-roles-update.service';

describe('AdminUserRolesUpdateService', () => {
  it('updates roles and invalidates the catalog', async () => {
    const deps = createDeps();
    deps.commands.update.mockResolvedValue({ id: 4, roles: ['ROLE_ADMIN'] });

    const service = new AdminUserRolesUpdateService(
      deps.commands as any,
      deps.catalogInvalidation as any,
    );

    await expect(service.updateRoles(9, 4, ['ROLE_ADMIN'])).resolves.toEqual({
      id: 4,
      roles: ['ROLE_ADMIN'],
    });

    expect(deps.commands.update).toHaveBeenCalledWith(4, {
      roles: ['ROLE_ADMIN'],
    });
    expect(
      deps.catalogInvalidation.invalidateCatalogAndNotify,
    ).toHaveBeenCalledWith(9);
  });
});

function createDeps() {
  return {
    queries: {
      list: jest.fn(),
      get: jest.fn(),
    },
    commands: {
      create: jest.fn(),
      update: jest.fn(),
      resetPassword: jest.fn(),
      ban: jest.fn(),
      unban: jest.fn(),
      delete: jest.fn(),
    },
    catalogInvalidation: {
      invalidateCatalogAndNotify: jest.fn(),
    },
  };
}
