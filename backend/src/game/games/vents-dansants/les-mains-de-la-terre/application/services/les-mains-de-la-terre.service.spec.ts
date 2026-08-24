import { LesMainsDeLaTerreService } from '../../application/services/les-mains-de-la-terre.service';

describe('LesMainsDeLaTerreService', () => {
  it('doit Ãªtre dÃ©fini', () => {
    const registry = { register: jest.fn() } as any;
    const service = new LesMainsDeLaTerreService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});


