import { CerclesSacresService } from '../cercles-sacres.service';

describe('CerclesSacresService', () => {
  it('should be defined', () => {
    const registry = { register: jest.fn() } as any;
    const service = new CerclesSacresService(registry, {} as any, {} as any, {} as any, {} as any);
    expect(service).toBeDefined();
  });
});
