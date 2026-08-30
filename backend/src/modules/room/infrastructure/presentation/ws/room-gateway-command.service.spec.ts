import { getErrorPayload } from '@shared/utils/public-api';
import { RoomGatewayCommandService } from './room-gateway-command.service';

describe('RoomGatewayCommandService transport pipeline', () => {
  const commands = new RoomGatewayCommandService();

  it('validates and normalizes a known command envelope', () => {
    expect(
      commands.decode(
        JSON.stringify({ type: ' room.ping ', payload: { clientSentAtMs: 1 } }),
      ),
    ).toEqual({ type: 'room.ping', payload: { clientSentAtMs: 1 } });
  });

  it('presents malformed and unknown commands through stable error codes', () => {
    for (const [raw, code] of [
      ['not-json', 'ROOM_WS_INVALID_MESSAGE'],
      [JSON.stringify({ type: 'room.unknown' }), 'ROOM_WS_UNKNOWN_COMMAND'],
    ] as const) {
      try {
        commands.decode(raw);
        throw new Error('decode should fail');
      } catch (error) {
        expect(getErrorPayload(error)).toEqual(
          expect.objectContaining({ code }),
        );
      }
    }
  });

  it('rejects oversized Room payloads before JSON parsing', () => {
    expect(() => commands.decode('x'.repeat(65_537))).toThrow();
  });
});
