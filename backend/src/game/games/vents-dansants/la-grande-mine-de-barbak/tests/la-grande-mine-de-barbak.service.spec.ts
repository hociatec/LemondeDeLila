import { Test } from '@nestjs/testing';
import { LaGrandeMineDeBarbakModule } from '../la-grande-mine-de-barbak.module';
import { LaGrandeMineDeBarbakService } from '../la-grande-mine-de-barbak.service';

describe('LaGrandeMineDeBarbakService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [LaGrandeMineDeBarbakModule],
    }).compile();

    const service = module.get(LaGrandeMineDeBarbakService);
    expect(service).toBeDefined();
  });
});
