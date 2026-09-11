import type { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import { ApplicationShutdownService } from '../application/application-shutdown.service';

type ShutdownSockets = { closeConnections(): Promise<void> };

/** The production signal/programmatic entry point; Nest destroy hooks run last. */
export function installGracefulShutdown(
  app: INestApplication,
  shutdown: ApplicationShutdownService,
  sockets: ShutdownSockets,
  reportError: (error: unknown) => void,
): () => Promise<void> {
  const closeResources = app.close.bind(app);
  let closing: Promise<void> | undefined;
  const stop = async (): Promise<void> => {
    shutdown.stopAccepting();
    const server: unknown = app.getHttpServer();
    if (!(server instanceof Server)) throw new Error('Expected HTTP server');
    const httpClosed = new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (
          error &&
          (!('code' in error) || error.code !== 'ERR_SERVER_NOT_RUNNING')
        )
          reject(error);
        else resolve();
      });
    });
    // Observe a possible immediate failure while the application drains.
    void httpClosed.catch(reportError);
    await shutdown.stopSources();
    await shutdown.drain();
    await sockets.closeConnections();
    // Socket close callbacks can still persist sessions/membership.
    await shutdown.drain();
    await httpClosed;
    await closeResources();
    process.removeListener('SIGTERM', signal);
    process.removeListener('SIGINT', signal);
  };
  const close = () => (closing ??= stop());
  const signal = () => {
    void close().catch(reportError);
  };
  process.on('SIGTERM', signal);
  process.on('SIGINT', signal);
  return close;
}
