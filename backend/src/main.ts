import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ServLoggerService } from './common/observability/public-api';
import { LilaWsAdapter } from './common/ws/infrastructure/platform/lila-ws.adapter';

const bootstrapLogger = new Logger('bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ServLoggerService(),
    // Important: let errors bubble so our bootstrap().catch can log them.
    // Otherwise Nest may abort via ExceptionsZone and exit(1) without any useful output.
    abortOnError: false,
  });
  const config = app.get(ConfigService);

  const nodeEnv = (
    config.get<string>('NODE_ENV') ||
    process.env.NODE_ENV ||
    'development'
  ).toLowerCase();

  if (!config.get<string>('CLIENT_UPDATES_DIR') && nodeEnv === 'production') {
    console.warn(
      '[updates] CLIENT_UPDATES_DIR is not set; using the default path from ClientUpdatesService. ' +
        'For explicit control, set CLIENT_UPDATES_DIR in the systemd environment.',
    );
  }

  app.use(helmet());
  app.use(compression());

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
    new ValidationPipe({
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
