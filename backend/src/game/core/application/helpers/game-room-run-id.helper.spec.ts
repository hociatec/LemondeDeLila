import { resolveGameStateRunId } from './game-room-run-id.helper';

describe('resolveGameStateRunId', () => {
  it('assigns setup state to the next room run', () => {
    expect(resolveGameStateRunId({ status: 'setup', runId: 4 })).toBe(5);
  });

  it('keeps started state on the current room run', () => {
    expect(resolveGameStateRunId({ status: 'started', runId: 5 })).toBe(5);
  });

  it('rejects missing and unsupported run contexts', () => {
    expect(resolveGameStateRunId({ status: 'setup', runId: null })).toBeNull();
    expect(resolveGameStateRunId({ status: 'finished', runId: 5 })).toBeNull();
  });
});
