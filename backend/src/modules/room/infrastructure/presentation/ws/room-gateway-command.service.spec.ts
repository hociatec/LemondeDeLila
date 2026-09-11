import { getErrorPayload } from '../../../../../platform/serialization/public-api';
import { RoomGatewayCommandService } from './room-gateway-command.service';
import { decodeRoomMessage } from './room-intent-decoder';
import type { WsRequestRateLimitService } from '../../../../../platform/ws/public-api';

describe('RoomGatewayCommandService transport pipeline', () => {
  it('refuses chat and costly commands before acknowledgement or execution when quota is exhausted', async () => {
    const allow = jest.fn().mockResolvedValue(false);
    const service = new RoomGatewayCommandService(
      {
        allow,
      } as unknown as WsRequestRateLimitService,
      { now: () => Date.now() },
    );
    const safeSend = jest.fn();
    const context = { safeSend } as unknown as Parameters<
      RoomGatewayCommandService['handleCommand']
    >[0];
    const client = {} as Parameters<
      RoomGatewayCommandService['handleCommand']
    >[1];
    const meta = { userId: 42 } as Parameters<
      RoomGatewayCommandService['handleCommand']
    >[2];
    for (const intentId of ['room.chat.send', 'room.start', 'bot.add']) {
      await service.handleCommand(context, client, meta, {
        type: 'room.intent.execute',
        payload: { intentId, data: {} },
      });
    }
    expect(allow).toHaveBeenCalledWith(42);
    expect(safeSend).toHaveBeenCalledTimes(3);
    expect(safeSend).toHaveBeenLastCalledWith(
      client,
      expect.objectContaining({
        payload: expect.objectContaining({ code: 'WS_RATE_LIMITED' }),
      }),
    );
  });

  it('accepts only the canonical intent envelope', () => {
    expect(
      decodeRoomMessage(
        JSON.stringify({
          type: 'room.intent.execute',
          payload: { intentId: 'room.ping', data: { clientSentAtMs: 1 } },
        }),
      ),
    ).toEqual({
      type: 'room.intent.execute',
      payload: { intentId: 'room.ping', data: { clientSentAtMs: 1 } },
    });
  });

  it('presents malformed and unknown commands through stable error codes', () => {
    for (const [raw, code] of [
      ['not-json', 'ROOM_WS_INVALID_MESSAGE'],
      [JSON.stringify({ type: 'room.unknown' }), 'ROOM_WS_UNKNOWN_COMMAND'],
      [JSON.stringify({ type: 'room.ping' }), 'ROOM_WS_UNKNOWN_COMMAND'],
    ] as const) {
      try {
        decodeRoomMessage(raw);
        throw new Error('decode should fail');
      } catch (error) {
        expect(getErrorPayload(error)).toEqual(
          expect.objectContaining({ code }),
        );
      }
    }
  });

  it('rejects oversized Room payloads before JSON parsing', () => {
    expect(() => decodeRoomMessage('x'.repeat(65_537))).toThrow();
  });
});
