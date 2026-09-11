import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { ApplicationShutdownService } from '../../../lifecycle/public-api';
import { WsWorkService } from '../../application/services/ws-work.service';
import { LilaWsAdapter } from './lila-ws.adapter';

it('terminates an unresponsive socket only after its close handshake grace period', async () => {
  jest.useFakeTimers();
  try {
    const socket = Object.assign(new EventEmitter(), {
      readyState: WebSocket.OPEN,
      close: jest.fn(),
      terminate: jest.fn(() => {
        socket.emit('close');
      }),
    });
    const server = {
      clients: new Set([socket]),
      on: jest.fn(),
      close: jest.fn(),
    };
    const adapter = new LilaWsAdapter();
    adapter.create(1, { server });
    const closing = adapter.closeConnections();
    expect(socket.close).toHaveBeenCalledWith(1001, 'Server shutdown');
    await jest.advanceTimersByTimeAsync(999);
    expect(socket.terminate).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await closing;
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it('refuses a new socket command during drain while allowing disconnect cleanup', async () => {
  const shutdown = new ApplicationShutdownService();
  const boundary = new WsWorkService(shutdown);
  const socket = { close: jest.fn() };
  const command = jest.fn();
  const cleanup = jest.fn();
  shutdown.stopAccepting();
  await boundary.run(socket, command);
  expect(command).not.toHaveBeenCalled();
  expect(socket.close).toHaveBeenCalledWith(1012, 'Server restarting');
  await boundary.run(socket, cleanup, true);
  expect(cleanup).toHaveBeenCalledTimes(1);
});
