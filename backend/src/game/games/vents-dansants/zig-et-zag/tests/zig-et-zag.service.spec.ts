import { Test } from '@nestjs/testing';
import { ZigEtZagModule } from '../zig-et-zag.module';
import { ZigEtZagService } from '../zig-et-zag.service';

describe('ZigEtZagService', () => {
  it('should be defined', async () => {
    const module = await Test.createTestingModule({
      imports: [ZigEtZagModule],
    }).compile();

    const service = module.get(ZigEtZagService);
    expect(service).toBeDefined();
  });
});
