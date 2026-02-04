import { Test } from '@nestjs/testing';
import { DameNatureModule } from '../dame-nature.module';
import { DameNatureService } from '../dame-nature.service';

describe('DameNatureService', () => {
  it('devrait être défini', async () => {
    const module = await Test.createTestingModule({
      imports: [DameNatureModule],
    }).compile();

    const service = module.get(DameNatureService);
    expect(service).toBeDefined();
  });
});
