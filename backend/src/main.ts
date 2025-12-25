import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ServLoggerService } from './common/services/serv-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ServLoggerService(),
  });
  const config = app.get(ConfigService);
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
  app.useWebSocketAdapter(new WsAdapter(app));
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
