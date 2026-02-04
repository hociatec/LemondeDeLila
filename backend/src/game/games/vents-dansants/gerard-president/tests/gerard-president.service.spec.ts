import { Test } from '@nestjs/testing';
import { GerardPresidentModule } from '../gerard-president.module';
import { GerardPresidentService } from '../gerard-president.service';

describe('GerardPresidentService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [GerardPresidentModule],
    }).compile();

    const service = module.get(GerardPresidentService);
    expect(service).toBeDefined();
  });
});
