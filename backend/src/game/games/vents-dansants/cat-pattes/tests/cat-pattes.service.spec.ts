import { Test } from '@nestjs/testing';
import { CatPattesModule } from '../cat-pattes.module';
import { CatPattesService } from '../cat-pattes.service';

describe('CatPattesService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [CatPattesModule],
    }).compile();

    const service = module.get(CatPattesService);
    expect(service).toBeDefined();
  });
});
