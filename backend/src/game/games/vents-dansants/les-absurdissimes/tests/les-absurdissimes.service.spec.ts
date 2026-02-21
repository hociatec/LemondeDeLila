import { LesAbsurdissimesService } from '../les-absurdissimes.service';

describe('LesAbsurdissimesService', () => {
  it('should be defined', () => {
    const registry = { register: jest.fn() } as any;
    const service = new LesAbsurdissimesService(
      registry,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});
