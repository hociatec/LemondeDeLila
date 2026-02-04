import { Test } from '@nestjs/testing';
import { CerclesSacresModule } from '../cercles-sacres.module';
import { CerclesSacresService } from '../cercles-sacres.service';

describe('CerclesSacresService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [CerclesSacresModule],
    }).compile();

    const service = module.get(CerclesSacresService);
    expect(service).toBeDefined();
  });
});
