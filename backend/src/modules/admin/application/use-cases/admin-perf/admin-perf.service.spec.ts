import { AdminPerfService } from './admin-perf.service';

describe('AdminPerfService', () => {
  it('delegates perf snapshot query', () => {
    const snapshot = jest.fn().mockReturnValue({ events: [] });
    const service = new AdminPerfService({ snapshot } as any);

    expect(service.snapshot({ windowSeconds: 120 })).toEqual({ events: [] });
    expect(snapshot).toHaveBeenCalledWith({ windowSeconds: 120 });
  });
});
