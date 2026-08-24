import { CatPattesService } from '../../application/services/cat-pattes.service';
import { createCatPattesRuntime } from '../../cat-pattes.runtime';

describe('CatPattesService', () => {
  it('should be defined', () => {
    const { service } = createCatPattesRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CatPattesService);
  });
});




