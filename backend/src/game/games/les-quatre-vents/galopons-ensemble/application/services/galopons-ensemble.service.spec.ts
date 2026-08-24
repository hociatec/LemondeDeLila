import { GaloponsEnsembleService } from '../../application/services/galopons-ensemble.service';
import { createGaloponsRuntime } from '../../galopons-ensemble.runtime';

describe('GaloponsEnsembleService', () => {
  it('should be defined', () => {
    const { service } = createGaloponsRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(GaloponsEnsembleService);
  });
});

