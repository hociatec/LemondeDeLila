import { Test } from '@nestjs/testing';
import { BandeABananeModule } from '../la-bande-a-banane.module';
import { BandeABananeService } from '../la-bande-a-banane.service';

describe('BandeABananeService', () => {
  it('devrait être défini', async () => {
    const module = await Test.createTestingModule({
      imports: [BandeABananeModule],
    }).compile();

    const service = module.get(BandeABananeService);
    expect(service).toBeDefined();
  });
});
