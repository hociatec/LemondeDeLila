import { DameNatureService } from '../../application/services/dame-nature.service';

describe('DameNatureService', () => {
  it('devrait Ãªtre dÃ©fini', () => {
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


