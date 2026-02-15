import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowModule } from '../../../../modules/setup-flow/setup-flow.module';
import { SacAMalicesSetupService } from '../setup/sac-a-malices-setup.service';
import { SAC_VARIANTS } from '../sac-a-malices-variants';

describe('Sac À Malices setup', () => {
  it('publie une demande de variante quand aucun choix n\'est encore fait', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SetupFlowModule],
      providers: [
        GameContentLoaderService,
        RandomService,
        SacAMalicesSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(SacAMalicesSetupService);
    const base: GameStateEntity = {
      status: 'open',
      phase: 'setup',
      players: [
        { id: 1, username: 'Annie' } as any,
        { id: 2, username: 'Benoît' } as any,
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: { gameType: 'sac-a-malices' },
    } as any;

    const next = setup.hydrateInitialState(base);
    expect(next.pending).not.toBeNull();
    expect(next.pending?.type).toBe('sac_variant_choice');
    expect(next.pending?.choices).toContain(SAC_VARIANTS[0].label);
    const variants =
      (next.pending?.data as any)?.variants ?? [];
    expect(Array.isArray(variants)).toBe(true);
    expect(variants.length).toBe(SAC_VARIANTS.length);
    expect(next.turn?.currentPlayerId).toBe(next.pending?.playerId);
  });
});
