import { ZigEtZagService } from '../zig-et-zag.service';

describe('ZigEtZagService', () => {
  it('should be defined', () => {
    const registry = { register: jest.fn() } as any;
    const service = new ZigEtZagService(registry, {} as any, {} as any, {} as any, {} as any);
    expect(service).toBeDefined();
  });
});
