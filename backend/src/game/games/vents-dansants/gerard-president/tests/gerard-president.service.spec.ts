import { GerardPresidentService } from '../gerard-president.service';

describe('GerardPresidentService', () => {
  it('should be defined', () => {
    const registry = { register: jest.fn() } as any;
    const service = new GerardPresidentService(registry, {} as any, {} as any, {} as any, {} as any);
    expect(service).toBeDefined();
  });
});
