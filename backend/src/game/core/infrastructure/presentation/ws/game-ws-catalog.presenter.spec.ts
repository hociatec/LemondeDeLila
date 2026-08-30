import { GAMEPLAY_MECHANICS_CATALOG } from '../../../../engine/runtime/definitions/mechanics-catalog';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRegistryService } from '../../../application/services/game-registry.service';
import { GameWsCatalogPresenter } from './game-ws-catalog.presenter';

describe('GameWsCatalogPresenter', () => {
  it('assembles modules, game descriptors and the SDK catalog', () => {
    const modules = [{ id: 'module-a' }];
    const games = [{ id: 'game-a' }];
    const overviewRegistry = {
      getModules: jest.fn(() => modules),
    } as unknown as GameModuleOverviewRegistryService;
    const registry = {
      listDescriptors: jest.fn(() => games),
    } as unknown as GameRegistryService;

    expect(
      new GameWsCatalogPresenter(overviewRegistry, registry).present(),
    ).toEqual({
      modules,
      games,
      sdk: GAMEPLAY_MECHANICS_CATALOG,
    });
  });
});
