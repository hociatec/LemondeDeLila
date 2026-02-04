import { Test } from '@nestjs/testing';
import { LesMainsDeLaTerreModule } from '../les-mains-de-la-terre.module';
import { LesMainsDeLaTerreService } from '../les-mains-de-la-terre.service';

describe('LesMainsDeLaTerreService', () => {
  it('doit être défini', async () => {
    const module = await Test.createTestingModule({
      imports: [LesMainsDeLaTerreModule],
    }).compile();

    const service = module.get(LesMainsDeLaTerreService);
    expect(service).toBeDefined();
  });
});
