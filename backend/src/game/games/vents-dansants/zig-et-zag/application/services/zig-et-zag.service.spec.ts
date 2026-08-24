import { ZigEtZagService } from '../../application/services/zig-et-zag.service';
import { createZigEtZagRuntime } from '../../zig-et-zag.runtime';

describe('ZigEtZagService', () => {
  it('should be defined', () => {
    const { service } = createZigEtZagRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ZigEtZagService);
  });
});


