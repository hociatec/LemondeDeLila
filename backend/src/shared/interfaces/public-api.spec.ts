import { asGameId, asMessageId, asRoomId, asUserId } from './public-api';

describe('nominal identifiers', () => {
  it('validates and distinguishes identifier kinds at construction boundaries', () => {
    expect(asUserId(1)).toBe(1);
    expect(asRoomId(2)).toBe(2);
    expect(asGameId('panier-express')).toBe('panier-express');
    expect(asMessageId('message-1')).toBe('message-1');
    expect(() => asUserId(0)).toThrow();
    expect(() => asRoomId(-1)).toThrow();
  });
});
