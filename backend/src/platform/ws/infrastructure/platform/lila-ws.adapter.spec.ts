import { LilaWsAdapter } from './lila-ws.adapter';

describe('LilaWsAdapter payload policy', () => {
  it('keeps the global WebSocket payload limit explicit', () => {
    const source = LilaWsAdapter.prototype.create.toString();
    expect(source).toContain('DEFAULT_MAX_PAYLOAD_BYTES');
  });
});
