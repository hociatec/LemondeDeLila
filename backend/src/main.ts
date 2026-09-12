import { Logger, type INestApplication } from '@nestjs/common';
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
  sanitizeLogText,
} from './platform/observability/public-api';
import { LilaWsAdapter } from './platform/ws/infrastructure/platform/lila-ws.adapter';
import {
  isBoundedJsonInput,
  NormalizedValidationPipe,
} from './platform/validation/public-api';
import { configureOpenApi } from './platform/openapi/public-api';
import { ApplicationShutdownService } from './platform/lifecycle/public-api';
import { installGracefulShutdown } from './platform/lifecycle/infrastructure/install-graceful-shutdown';
import { shutdownHttpMiddleware } from './platform/lifecycle/infrastructure/shutdown-http.middleware';

const bootstrapLogger = new Logger('bootstrap');

function reportShutdownError(error: unknown): void {
  bootstrapLogger.error('graceful shutdown failed', sanitizeLogText(error));
  process.exitCode = 1;
}

function validateJsonBody(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (request.body !== undefined && !isBoundedJsonInput(request.body)) {
    response
      .status(400)
      .json({ message: 'Structure JSON invalide ou trop complexe' });
    return;
  }
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ServLoggerService(),
    // Important: let errors bubble so our bootstrap().catch can log them.
    // Otherwise Nest may abort via ExceptionsZone and exit(1) without any useful output.
    abortOnError: false,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const shutdown = app.get(ApplicationShutdownService);

  await configureApplication(app, config, shutdown);
}

async function configureApplication(
  app: INestApplication,
  config: ConfigService,
  shutdown: ApplicationShutdownService,
): Promise<void> {
  const nodeEnvRaw = config.get<string>('NODE_ENV', 'development');
  const nodeEnv =
    typeof nodeEnvRaw === 'string' && nodeEnvRaw.length <= 64
      ? nodeEnvRaw.toLowerCase()
      : 'development';
  const trustedProxies = String(config.get<string>('TRUSTED_PROXY_CIDRS') ?? '')
    .split(',')
    .map((value) => value.trim().slice(0, 128))
    .filter(Boolean)
    .slice(0, 64);
  const express = app.getHttpAdapter().getInstance() as Application;
  express.set(
    'trust proxy',
    trustedProxies.length > 0 ? trustedProxies : false,
  );

  app.use(shutdownHttpMiddleware(shutdown));
  app.use(helmet());
  app.use(compression());
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb', parameterLimit: 200 }));
  app.use(validateJsonBody);
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
        .map((origin) => origin.trim().slice(0, 2_048))
        .filter(Boolean)
        .slice(0, 128)
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

  const sockets = new LilaWsAdapter(app, shutdown);
  app.useWebSocketAdapter(sockets);
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

  const configuredPort = Number(config.get<number>('PORT', 3000));
  const port =
    Number.isSafeInteger(configuredPort) &&
    configuredPort >= 1 &&
    configuredPort <= 65_535
      ? configuredPort
      : 3000;
  await app.listen(port);
  installGracefulShutdown(app, shutdown, sockets, reportShutdownError);
  bootstrapLogger.log(`listening on ${port}`);
}

bootstrap().catch((err) => {
  console.error('bootstrap failed', sanitizeLogText(err));
  bootstrapLogger.error('failed', sanitizeLogText(err));
  process.exit(1);
});
