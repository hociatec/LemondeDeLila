import { PimpMyRideService } from '../pimp-my-ride.service';

describe('PimpMyRideService', () => {
  it('devrait �tre d�fini', () => {
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
