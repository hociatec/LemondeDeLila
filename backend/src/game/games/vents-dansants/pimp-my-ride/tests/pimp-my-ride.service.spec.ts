import { Test } from '@nestjs/testing';
import { PimpMyRideModule } from '../pimp-my-ride.module';
import { PimpMyRideService } from '../pimp-my-ride.service';

describe('PimpMyRideService', () => {
  it('devrait être défini', async () => {
    const module = await Test.createTestingModule({
      imports: [PimpMyRideModule],
    }).compile();

    const service = module.get(PimpMyRideService);
    expect(service).toBeDefined();
  });
});
