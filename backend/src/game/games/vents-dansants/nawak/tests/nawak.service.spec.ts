import { NawakService } from '../nawak.service';

describe('NawakService', () => {
  it('should be defined', () => {
    const registry = { register: jest.fn() } as any;
    const service = new NawakService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});
