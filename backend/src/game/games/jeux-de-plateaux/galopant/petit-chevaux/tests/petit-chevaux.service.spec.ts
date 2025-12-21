import { Test } from '@nestjs/testing';
import { PetitChevauxModule } from '../petit-chevaux.module';
import { PetitChevauxService } from '../petit-chevaux.service';

describe('PetitChevauxService', () => {
  it('hydrates and exposes without actions', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PetitChevauxModule],
    }).compile();
    const service = moduleRef.get(PetitChevauxService);
    const state: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
    } as any);
    const exposed: any = service.exposeState(state);
    expect(exposed.actions ?? []).toHaveLength(0);
  });
});
