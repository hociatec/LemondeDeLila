import { PimpMyRideService } from '../../application/services/pimp-my-ride.service';

describe('PimpMyRideService', () => {
  it('devrait Ãªtre dÃ©fini', () => {
    const registry = { register: jest.fn() } as any;
    const service = new PimpMyRideService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});


