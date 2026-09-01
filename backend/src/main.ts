import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import {
  json,
  urlencoded,
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  normalizeCorrelationId,
  prometheusMetrics,
  runWithCorrelationId,
  ServLoggerService,
} from './platform/observability/public-api';
import { LilaWsAdapter } from './platform/ws/infrastructure/platform/lila-ws.adapter';
import { NormalizedValidationPipe } from './platform/validation/public-api';
import { configureOpenApi } from './platform/openapi/public-api';

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
  const trustedProxies = String(config.get<string>('TRUSTED_PROXY_CIDRS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const express = app.getHttpAdapter().getInstance() as Application;
  express.set(
    'trust proxy',
    trustedProxies.length > 0 ? trustedProxies : false,
  );

  app.use(helmet());
  app.use(compression());
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb', parameterLimit: 200 }));
  app.use(prometheusMetrics.middleware.bind(prometheusMetrics));
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
  const openApiEnabled = config.get<boolean>(
    'OPENAPI_ENABLED',
    nodeEnv !== 'production',
  );
  if (openApiEnabled) configureOpenApi(app);

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
