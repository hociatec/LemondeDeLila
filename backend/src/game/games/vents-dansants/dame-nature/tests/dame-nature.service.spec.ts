import { DameNatureService } from '../dame-nature.service';

describe('DameNatureService', () => {
  it('devrait être défini', () => {
    const registry = { register: jest.fn() } as any;
    const service = new DameNatureService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});
