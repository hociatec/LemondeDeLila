import { CerclesSacresService } from '../../application/services/cercles-sacres.service';
import { createCerclesSacresRuntime } from '../../cercles-sacres.runtime';

describe('CerclesSacresService', () => {
  it('should be defined', () => {
    const { service } = createCerclesSacresRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CerclesSacresService);
  });
});


