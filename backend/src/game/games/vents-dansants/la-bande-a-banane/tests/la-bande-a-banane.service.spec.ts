import { BandeABananeService } from '../la-bande-a-banane.service';

describe('BandeABananeService', () => {
  it('devrait être défini', () => {
    const registry = { register: jest.fn() } as any;
    const service = new BandeABananeService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});
