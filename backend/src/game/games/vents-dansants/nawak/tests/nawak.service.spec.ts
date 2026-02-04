import { Test } from '@nestjs/testing';
import { NawakModule } from '../nawak.module';
import { NawakService } from '../nawak.service';

describe('NawakService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [NawakModule],
    }).compile();

    const service = module.get(NawakService);
    expect(service).toBeDefined();
  });
});
