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

function writeUpdatesLandingPage(updatesDir: string) {
  try {
    const indexPath = path.join(updatesDir, 'index.html');
    if (fs.existsSync(indexPath)) return;

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
    fs.writeFileSync(indexPath, html, 'utf-8');
  } catch {
    // best-effort
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
    path.resolve(process.cwd(), 'data', 'client-updates', 'client-win');
  try {
    fs.mkdirSync(updatesDir, { recursive: true });
  } catch {
    /* ignore */
  }
  writeUpdatesLandingPage(updatesDir);
  app.use(
    '/updates/client-win',
    // ClickOnce manifeste utilise souvent des chemins Windows (backslashes).
    // Si le client demande des URLs contenant "\" ou "%5C", normaliser vers "/" pour éviter
    // des 404 qui se traduisent côté ClickOnce par "Des fichiers manquent".
    (req: any, _res: any, next: any) => {
      try {
        if (typeof req?.url === 'string' && (req.url.includes('\\') || /%5c/i.test(req.url))) {
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
  // Ensure we have a startup marker even when logs are redirected by systemd.
  try {
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] listening on ${port}`);
  } catch {
    /* ignore */
  }
}
bootstrap().catch((err) => {
  try {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] failed', err);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
