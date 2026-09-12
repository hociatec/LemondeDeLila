import type { INestApplication } from '@nestjs/common';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { ApplicationShutdownService } from '../application/application-shutdown.service';
import { LilaWsAdapter } from '../../ws/infrastructure/platform/lila-ws.adapter';
import { WsWorkService } from '../../ws/application/services/ws-work.service';
import { installGracefulShutdown } from './install-graceful-shutdown';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('drains a real WebSocket command, then its disconnect write, before resource closure', async () => {
  const shutdown = new ApplicationShutdownService();
  const work = new WsWorkService(shutdown);
  const server = createServer();
  const adapter = new LilaWsAdapter(server, shutdown);
  const wsServer = adapter.create(0, { path: '/socket' }) as WebSocketServer;
  const accepted = deferred(),
    commit = deferred(),
    disconnected = deferred(),
    cleanup = deferred();
  wsServer.on('connection', (socket) => {
    socket.on('message', () => {
      void work.run(socket, async () => {
        accepted.resolve();
        await commit.promise;
        socket.send('committed');
      });
    });
    socket.on('close', () => {
      void work.run(
        socket,
        async () => {
          disconnected.resolve();
          await cleanup.promise;
        },
        true,
      );
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP address');
  const client = new WebSocket(`ws://127.0.0.1:${address.port}/socket`);
  const closeResources = jest.fn(async () => undefined);
  // Only the public Nest surface used by the shutdown installer is required.
  const app = {
    close: closeResources,
    getHttpServer: () => server,
  } as unknown as INestApplication;
  const report = jest.fn();
  const close = installGracefulShutdown(app, shutdown, adapter, report);
  try {
    await once(client, 'open');
    client.send('mutate');
    await accepted.promise;
    const reply = once(client, 'message');
    const clientClosed = once(client, 'close');
    const closing = close();
    expect(close()).toBe(closing);
    expect(server.listening).toBe(false);
    expect(closeResources).not.toHaveBeenCalled();
    commit.resolve();
    const [message] = await reply;
    expect(String(message)).toBe('committed');
    await disconnected.promise;
    expect(closeResources).not.toHaveBeenCalled();
    cleanup.resolve();
    await closing;
    const [code] = await clientClosed;
    expect(code).toBe(1001);
    expect(closeResources).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  } finally {
    commit.resolve();
    cleanup.resolve();
    client.terminate();
    await close();
    await adapter.close(wsServer);
    await adapter.dispose();
  }
});

it('continues every shutdown phase after cleanup failures and reports them together', async () => {
  const shutdown = new ApplicationShutdownService();
  const sourceError = new Error('source failed');
  const socketError = new Error('socket failed');
  shutdown.registerSource('failing-source', () => {
    throw sourceError;
  });
  const server = createServer();
  const closeResources = jest.fn(async () => undefined);
  const closeSockets = jest.fn(async () => {
    throw socketError;
  });
  const app = {
    close: closeResources,
    getHttpServer: () => server,
  } as unknown as INestApplication;
  const close = installGracefulShutdown(
    app,
    shutdown,
    { closeConnections: closeSockets },
    jest.fn(),
  );
  const error = await close().catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error('Expected failures');
  expect(error.errors).toEqual([sourceError, socketError]);
  expect(closeSockets).toHaveBeenCalledTimes(1);
  expect(closeResources).toHaveBeenCalledTimes(1);
});
