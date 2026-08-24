import { LaGrandeMineDeBarbakService } from '../../application/services/la-grande-mine-de-barbak.service';

describe('LaGrandeMineDeBarbakService', () => {
  it('should be defined', () => {
    const registry = { register: jest.fn() } as any;
    const service = new LaGrandeMineDeBarbakService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});


