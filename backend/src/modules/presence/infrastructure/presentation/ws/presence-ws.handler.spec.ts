import type { WebSocket } from 'ws';
import type { WsRequestRateLimitService } from '../../../../../platform/ws/public-api';
import type { PresenceService } from '../../../application/services/presence.service';
import { PresenceWsHandler } from './presence-ws.handler';

it('closes an over-quota session without processing its payload', async () => {
  const session = { user: { id: 42 } };
  const handleClientPayload = jest.fn();
  const presence = {
    findClient: () => session,
    handleClientPayload,
  } as unknown as PresenceService;
  const allow = jest.fn().mockResolvedValue(false);
  const handler = new PresenceWsHandler(presence, {
    allow,
  } as unknown as WsRequestRateLimitService);
  const close = jest.fn();
  await handler.handleIncoming({ close } as unknown as WebSocket, '{}');
  expect(allow).toHaveBeenCalledWith(42);
  expect(close).toHaveBeenCalledWith(1013, 'rate limit');
  expect(handleClientPayload).not.toHaveBeenCalled();
});
