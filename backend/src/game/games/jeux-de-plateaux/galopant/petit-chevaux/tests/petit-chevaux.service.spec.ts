import { Test } from '@nestjs/testing';
import { PetitChevauxModule } from '../petit-chevaux.module';
import { PetitChevauxService } from '../petit-chevaux.service';

describe('PetitChevauxService', () => {
  it('hydrates and exposes with roll for current player', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PetitChevauxModule],
    }).compile();
    const service = moduleRef.get(PetitChevauxService);
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
    expect((exposedA.actions ?? []).some((a: any) => a.type === 'roll')).toBe(true);
    expect((exposedB.actions ?? []).some((a: any) => a.type === 'roll')).toBe(false);
  });
});
