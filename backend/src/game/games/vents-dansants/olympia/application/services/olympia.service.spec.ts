import { OlympiaService } from '../../application/services/olympia.service';
import { createOlympiaRuntime } from '../../olympia.runtime';

describe('OlympiaService', () => {
  it('should be defined', () => {
    const { service } = createOlympiaRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(OlympiaService);
  });
});

