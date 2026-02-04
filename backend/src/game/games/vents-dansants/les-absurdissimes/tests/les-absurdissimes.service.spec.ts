import { Test } from '@nestjs/testing';
import { LesAbsurdissimesModule } from '../les-absurdissimes.module';
import { LesAbsurdissimesService } from '../les-absurdissimes.service';

describe('LesAbsurdissimesService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [LesAbsurdissimesModule],
    }).compile();

    const service = module.get(LesAbsurdissimesService);
    expect(service).toBeDefined();
  });
});
