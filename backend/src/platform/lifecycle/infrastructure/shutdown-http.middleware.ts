import type { RequestHandler } from 'express';
import type { ApplicationShutdownService } from '../application/application-shutdown.service';

export function shutdownHttpMiddleware(
  shutdown: ApplicationShutdownService,
): RequestHandler {
  return (_request, response, next) => {
    if (shutdown.isDraining) {
      response.setHeader('Connection', 'close');
      response.status(503).json({ message: 'Server is shutting down' });
      return;
    }
    next();
  };
}
