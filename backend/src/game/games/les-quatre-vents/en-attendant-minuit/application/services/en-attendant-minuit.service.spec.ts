import { EnAttendantMinuitService } from '../../application/services/en-attendant-minuit.service';
import { createMinuitRuntime } from '../../en-attendant-minuit.runtime';

describe('EnAttendantMinuitService', () => {
  it('should be defined', () => {
    const { service } = createMinuitRuntime();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(EnAttendantMinuitService);
  });
});

