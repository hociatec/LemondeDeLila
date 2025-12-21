import { Test } from '@nestjs/testing';
import { PetitChevauxModule } from '../petit-chevaux.module';
import { PetitChevauxService } from '../petit-chevaux.service';

describe('PetitChevaux scenario', () => {
  it('applies empty action list', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PetitChevauxModule],
    }).compile();
    const service = moduleRef.get(PetitChevauxService);
    const initial: any = service.hydrateInitialState({
      status: 'started',
      players: [{ id: 1, username: 'A' }],
    } as any);
    const next: any = service.applyActions(initial, [] as any);
    expect(next).toBeTruthy();
  });
});
