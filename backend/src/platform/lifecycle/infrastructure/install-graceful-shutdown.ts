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
    const errors: unknown[] = [];
    const attempt = async (operation: () => Promise<void>): Promise<void> => {
      try {
        await operation();
      } catch (error) {
        errors.push(error);
      }
    };
    try {
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
      // Observe immediately, then collect the failure in its ordered phase.
      const observedHttpClosed = httpClosed.catch((error: unknown) => {
        errors.push(error);
      });
      await attempt(() => shutdown.stopSources());
      await attempt(() => shutdown.drain());
      await attempt(() => sockets.closeConnections());
      // Socket close callbacks can still persist sessions/membership.
      await attempt(() => shutdown.drain());
      await observedHttpClosed;
      await attempt(() => closeResources());
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1)
        throw new AggregateError(errors, 'Application shutdown failed');
    } finally {
      process.removeListener('SIGTERM', signal);
      process.removeListener('SIGINT', signal);
    }
  };
  const close = () => (closing ??= stop());
  const signal = () => {
    void close().catch(reportError);
  };
  process.on('SIGTERM', signal);
  process.on('SIGINT', signal);
  return close;
}
