import { GerardPresidentService } from '../../application/services/gerard-president.service';
import { createGerardPresidentRuntime } from '../../gerard-president.runtime';

describe('GerardPresidentService', () => {
  it('should be defined', () => {
    const { service } = createGerardPresidentRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(GerardPresidentService);
  });
});


