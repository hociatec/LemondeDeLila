import { Test } from '@nestjs/testing';
import { EntreRitesModule } from '../entre-rites.module';
import { EntreRitesService } from '../entre-rites.service';

describe('EntreRitesService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [EntreRitesModule],
    }).compile();

    const service = module.get(EntreRitesService);
    expect(service).toBeDefined();
  });
});
