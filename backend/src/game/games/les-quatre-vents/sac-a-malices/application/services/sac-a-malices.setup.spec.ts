import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { GameContentLoaderService } from '../../../../../core/application/services/game-content-loader.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { FilesystemGameCatalogReader } from '../../../../../core/infrastructure/system/filesystem-game-catalog.reader';
import { SacAMalicesSetupService } from './sac-a-malices-setup.service';
import { SAC_VARIANTS } from '../../sac-a-malices-variants';

describe('Sac a Malices setup', () => {
  it("publie une demande de variante quand aucun choix n'est encore fait", async () => {
    const catalogReader = new FilesystemGameCatalogReader();
    const contentLoader = new GameContentLoaderService(catalogReader);
    const random = new RandomService();
    const setupFlow = new SetupFlowService();
    const setup = new SacAMalicesSetupService(
      contentLoader,
      random,
      setupFlow,
    );

    const base: GameStateEntity = {
      status: 'open',
      phase: 'setup',
      players: [
        { id: 1, username: 'Annie' } as any,
        { id: 2, username: 'Benoit' } as any,
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: { gameType: 'sac-a-malices' },
    } as any;

    const next = setup.hydrateInitialState(base);
    expect(next.pending).not.toBeNull();
    expect(next.pending?.type).toBe('sac_variant_choice');
    expect(next.pending?.choices).toContain(SAC_VARIANTS[0].label);
    const variants = (next.pending?.data as any)?.variants ?? [];
    expect(Array.isArray(variants)).toBe(true);
    expect(variants.length).toBe(SAC_VARIANTS.length);
    expect(next.turn?.currentPlayerId).toBe(next.pending?.playerId);
  });
});
