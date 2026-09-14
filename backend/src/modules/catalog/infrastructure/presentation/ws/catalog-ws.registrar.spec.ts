import { CatalogWsRegistrar } from './catalog-ws.registrar';

describe('CatalogWsRegistrar', () => {
  it.each([
    [['ROLE_ADMIN'], true],
    [['admin'], true],
    [['ROLE_USER'], false],
    [undefined, false],
  ] as const)(
    'projects administrator access from roles %j',
    (roles, expected) => {
      let catalogAll!: (session: unknown) => unknown;
      const registry = {
        register: jest.fn(
          (type: string, handler: (session: unknown) => unknown) => {
            if (type === 'catalog.all') catalogAll = handler;
          },
        ),
      };
      const handler = {
        all: jest.fn(),
        categories: jest.fn(),
        categoryGames: jest.fn(),
        games: jest.fn().mockResolvedValue({ payload: [] }),
      };
      const registrar = new CatalogWsRegistrar(
        registry as never,
        handler as never,
      );
      registrar.onModuleInit();

      catalogAll({ user: roles === undefined ? null : { roles } });

      expect(handler.all).toHaveBeenCalledWith(expected);
    },
  );
});
