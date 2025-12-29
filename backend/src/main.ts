import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { LilaWsAdapter } from './common/ws/lila-ws.adapter';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ServLoggerService } from './common/services/serv-logger.service';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ServLoggerService(),
  });
  const config = app.get(ConfigService);

  // Static hosting for ClickOnce client updates through the existing API virtual host.
  // Nginx currently proxies all paths to the backend, so we serve /updates/* here.
  const updatesDir =
    config.get<string>('CLIENT_UPDATES_DIR') ||
    path.resolve(process.cwd(), 'data', 'client-updates', 'client-win');
  try {
    fs.mkdirSync(updatesDir, { recursive: true });
  } catch {
    /* ignore */
  }
  app.use(
    '/updates/client-win',
    express.static(updatesDir, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.application') {
          res.setHeader('Content-Type', 'application/x-ms-application');
        } else if (ext === '.manifest') {
          res.setHeader('Content-Type', 'application/x-ms-manifest');
        }
      },
    }),
  );

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
    origin: origins && origins.length > 0 ? origins : true,
    credentials: true,
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
}
bootstrap();
