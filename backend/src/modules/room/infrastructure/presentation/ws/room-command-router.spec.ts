import type { WebSocket } from 'ws';
import { routeRoomCommand } from './room-command-router';
import type { RoomCommandContext } from './room-command-context';
import type { ClientMeta } from './room-gateway.types';

it('routes snapshot resynchronization from the authenticated room metadata', async () => {
  const client = {} as WebSocket;
  const meta = { roomId: 42, userId: 7 } as ClientMeta;
  const handleRoomState = jest.fn().mockResolvedValue(undefined);

  await routeRoomCommand(
    { handleRoomState } as unknown as RoomCommandContext,
    client,
    meta,
    'room.state',
    { roomId: 999 },
    0,
  );

  expect(handleRoomState).toHaveBeenCalledWith(client, meta);
});
