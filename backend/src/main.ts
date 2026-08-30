import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  normalizeCorrelationId,
  runWithCorrelationId,
  ServLoggerService,
} from './platform/observability/public-api';
import { LilaWsAdapter } from './platform/ws/infrastructure/platform/lila-ws.adapter';
import { NormalizedValidationPipe } from './platform/validation/public-api';

const bootstrapLogger = new Logger('bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ServLoggerService(),
    // Important: let errors bubble so our bootstrap().catch can log them.
    // Otherwise Nest may abort via ExceptionsZone and exit(1) without any useful output.
    abortOnError: false,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);

  const nodeEnv = config.get<string>('NODE_ENV', 'development').toLowerCase();

  if (!config.get<string>('CLIENT_UPDATES_DIR') && nodeEnv === 'production') {
    console.warn(
      '[updates] CLIENT_UPDATES_DIR is not set; using the default path from ClientUpdatesService. ' +
        'For explicit control, set CLIENT_UPDATES_DIR in the systemd environment.',
    );
  }

  app.use(helmet());
  app.use(compression());
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb', parameterLimit: 200 }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const correlationId = normalizeCorrelationId(
      request.headers['x-request-id'],
    );
    response.setHeader('x-request-id', correlationId);
    runWithCorrelationId(correlationId, next);
  });

  const corsOrigins = config.get<string>('CORS_ORIGINS');
  const origins = corsOrigins
    ? corsOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : null;

  app.enableCors({
    origin:
      origins && origins.length > 0
        ? origins
        : nodeEnv === 'production'
          ? false
          : true,
    credentials: origins && origins.length > 0,
  });

  app.useWebSocketAdapter(new LilaWsAdapter(app));
  app.useGlobalPipes(
    new NormalizedValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  bootstrapLogger.log(`listening on ${port}`);
}

bootstrap().catch((err) => {
  console.error(
    'bootstrap failed',
    err instanceof Error ? err.stack : String(err),
  );
  bootstrapLogger.error(
    'failed',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
