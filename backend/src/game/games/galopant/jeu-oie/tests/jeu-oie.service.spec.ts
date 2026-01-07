import { Test } from '@nestjs/testing';
import { JeuOieModule } from '../jeu-oie.module';
import { JeuOieService } from '../jeu-oie.service';

describe('JeuOieService', () => {
  it('exposes roll only for current player', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JeuOieModule],
    }).compile();
    const service = moduleRef.get(JeuOieService);

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      metadata: {},
    } as any);

    const exposedA: any = service.exposeStateForUser(state, 1);
    const exposedB: any = service.exposeStateForUser(state, 2);

    expect((exposedA.actions ?? []).some((a: any) => a.type === 'roll')).toBe(
      true,
    );
    expect((exposedB.actions ?? []).some((a: any) => a.type === 'roll')).toBe(
      false,
    );
  });
});
