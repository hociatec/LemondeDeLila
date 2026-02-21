import { EntreRitesService } from '../entre-rites.service';

describe('EntreRitesService', () => {
  it('should be defined', () => {
    const registry = { register: jest.fn() } as any;
    const service = new EntreRitesService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});
