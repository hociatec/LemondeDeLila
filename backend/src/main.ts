import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { LilaWsAdapter } from './common/ws/lila-ws.adapter';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ServLoggerService } from './common/services/serv-logger.service';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';

const bootstrapLogger = new Logger('bootstrap');

function buildUpdatesLandingPageHtml(updatesDir: string): string {
  try {
    const entries = fs.readdirSync(updatesDir, { withFileTypes: true });
    const application = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .find((name) => name.toLowerCase().endsWith('.application'));

    const zipName = 'client-win.zip';
    const zipExists = fs.existsSync(path.join(updatesDir, zipName));

    const links: Array<{ href: string; label: string; note?: string }> = [];
    if (zipExists) {
      links.push({
        href: zipName,
        label: 'Télécharger (ZIP)',
        note: 'Version portable (à extraire).',
      });
    }
    if (application) {
      links.push({
        href: application,
        label: 'Installer / Mettre à jour (ClickOnce)',
        note: 'Si vous utilisez ClickOnce.',
      });
    }

    const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Le Monde de Lila – Mise à jour</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
      h1 { margin: 0 0 8px; }
      .muted { color: #666; }
      .card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; margin-top: 16px; }
      a.btn { display: inline-block; padding: 10px 14px; border-radius: 10px; background: #111; color: #fff; text-decoration: none; }
      a.btn.secondary { background: #2b2b2b; }
      .note { margin-top: 8px; color: #666; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>Mise à jour du client</h1>
    <div class="muted">Téléchargez la dernière version du client Windows.</div>
    <div class="card">
      ${
        links.length > 0
          ? links
              .map(
                (l, idx) =>
                  `<div style="margin-top: ${idx === 0 ? 0 : 12}px;">
                     <a class="btn ${idx === 0 ? '' : 'secondary'}" href="${l.href}">${l.label}</a>
                     ${l.note ? `<div class="note">${l.note}</div>` : ''}
                   </div>`,
              )
              .join('\n')
          : '<div>Aucun package disponible pour le moment.</div>'
      }
      <div class="note" style="margin-top: 16px;">
        Si l’application vous indique qu’une mise à jour est requise, installez la dernière version puis relancez.
      </div>
    </div>
  </body>
</html>`;
    return html;
  } catch {
    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Le Monde de Lila - Mise à jour</title>
  </head>
  <body>
    <h1>Mise à jour du client</h1>
    <div>Aucun package disponible pour le moment.</div>
  </body>
</html>`;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ServLoggerService(),
    // Important: let errors bubble so our bootstrap().catch can log them.
    // Otherwise Nest may abort via ExceptionsZone and exit(1) without any useful output.
    abortOnError: false,
  });
  const config = app.get(ConfigService);

  // Static hosting for ClickOnce client updates through the existing API virtual host.
  // Nginx currently proxies all paths to the backend, so we serve /updates/* here.
  const updatesDir =
    config.get<string>('CLIENT_UPDATES_DIR') ||
    // IMPORTANT: do not depend on process.cwd() (can vary between systemd / manual runs).
    // Keep a stable default path relative to the backend project root.
    path.resolve(__dirname, '..', 'data', 'client-updates', 'client-win');
  if (
    !config.get<string>('CLIENT_UPDATES_DIR') &&
    (process.env.NODE_ENV || '').toLowerCase() === 'production'
  ) {
    // This is the most common cause of "my ClickOnce client stopped working after a backend deploy":
    // deployments that run `git pull` in-place can overwrite backend/data/client-updates/*.
    // Keeping artifacts in a persistent directory outside the repo avoids that class of outage.
    // eslint-disable-next-line no-console
    console.warn(
      `[updates] CLIENT_UPDATES_DIR is not set; using default inside repo: ${updatesDir}. ` +
        `In production, set CLIENT_UPDATES_DIR to a persistent directory outside the git checkout to avoid losing ClickOnce artifacts on deploy.`,
    );
  }
  try {
    fs.mkdirSync(updatesDir, { recursive: true });
  } catch {
    /* ignore */
  }
  // Landing page is generated dynamically (no filesystem writes).
  app.use(
    '/updates/client-win',
    // ClickOnce manifeste utilise souvent des chemins Windows (backslashes).
    // Si le client demande des URLs contenant "\" ou "%5C", normaliser vers "/" pour éviter
    // des 404 qui se traduisent côté ClickOnce par "Des fichiers manquent".
    (req: any, res: any, next: any) => {
      try {
        const url = typeof req?.url === 'string' ? req.url : '';
        const pathname = url.split('?')[0] || '';
        if (pathname === '' || pathname === '/' || pathname === '/index.html') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          // ClickOnce should always revalidate this page/manifest in case a new version is published.
          res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          );
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.status(200).send(buildUpdatesLandingPageHtml(updatesDir));
          return;
        }
      } catch {
        // ignore (best-effort)
      }
      next();
    },
    (req: any, _res: any, next: any) => {
      try {
        if (
          typeof req?.url === 'string' &&
          (req.url.includes('\\') || /%5c/i.test(req.url))
        ) {
          req.url = req.url.replace(/%5c/gi, '/').replace(/\\/g, '/');
        }
      } catch {
        // ignore
      }
      next();
    },
    express.static(updatesDir, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.application') {
          res.setHeader('Content-Type', 'application/x-ms-application');
          res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          );
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (ext === '.manifest') {
          res.setHeader('Content-Type', 'application/x-ms-manifest');
          res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          );
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
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
  const nodeEnv = (
    config.get<string>('NODE_ENV') || 'development'
  ).toLowerCase();
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
  // Fallback: ensure we see the failure even if the Nest logger is not flushed/displayed.
  // eslint-disable-next-line no-console
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
