import { OdysseeQuatreCieuxService } from '../../application/services/odyssee.service';
import { createOdysseeRuntime } from '../../odyssee.runtime';

describe('OdysseeQuatreCieuxService', () => {
  it('should be defined', () => {
    const { service } = createOdysseeRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(OdysseeQuatreCieuxService);
  });
});

