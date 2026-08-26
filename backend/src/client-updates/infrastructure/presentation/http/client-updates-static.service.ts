import * as fs from 'fs';
import * as path from 'path';
import * as express from 'express';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ClientUpdatesService } from '../../../application/use-cases/client-updates/client-updates.service';

function buildUpdatesLandingPageHtml(updatesDir: string): string {
  try {
    const files = fs.existsSync(updatesDir) ? fs.readdirSync(updatesDir) : [];
    const apps = files
      .filter((f) => f.toLowerCase().endsWith('.application'))
      .sort((a, b) => a.localeCompare(b));

    const list = apps
      .map((f) => `<li><a href="${encodeURIComponent(f)}">${f}</a></li>`)
      .join('');

    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Le Monde de Lila - Mises à jour</title>
  </head>
  <body>
    <h1>Mises à jour du client</h1>
    ${
      list
        ? `<p>Derniers manifests ClickOnce :</p><ul>${list}</ul>`
        : `<p>Aucun package disponible pour le moment.</p>`
    }
  </body>
</html>`;
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

@Injectable()
export class ClientUpdatesStaticService implements OnModuleInit {
  private readonly logger = new Logger(ClientUpdatesStaticService.name);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly updates: ClientUpdatesService,
  ) {}

  onModuleInit(): void {
    const httpAdapter = this.adapterHost?.httpAdapter;
    const instance = httpAdapter?.getInstance?.();
    if (!instance || typeof instance.use !== 'function') {
      this.logger.warn('HTTP adapter does not support express middlewares');
      return;
    }

    const updatesDir = this.updates.getTargetDir();
    this.ensureUpdatesDirectory(updatesDir);
    instance.use(
      '/updates/client-win',
      this.landingPageMiddleware(updatesDir),
      this.normalizePathSeparators.bind(this),
      express.static(updatesDir, {
        setHeaders: this.setStaticHeaders.bind(this),
      }),
    );
  }

  private ensureUpdatesDirectory(updatesDir: string): void {
    try {
      fs.mkdirSync(updatesDir, { recursive: true });
    } catch {
      // The static middleware will surface inaccessible paths if requested.
    }
  }

  private landingPageMiddleware(updatesDir: string): express.RequestHandler {
    return (req, res, next) => {
      try {
        const url = typeof req.url === 'string' ? req.url : '';
        const pathname = url.split('?')[0] || '';
        if (pathname === '' || pathname === '/' || pathname === '/index.html') {
          this.setNoCacheHeaders(res);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.status(200).send(buildUpdatesLandingPageHtml(updatesDir));
          return;
        }
      } catch {
        // Landing page rendering is best effort.
      }
      next();
    };
  }

  private normalizePathSeparators(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ): void {
    try {
      if (
        typeof req.url === 'string' &&
        (req.url.includes('\\') || /%5c/i.test(req.url))
      ) {
        req.url = req.url.replace(/%5c/gi, '/').replace(/\\/g, '/');
      }
    } catch {
      // Keep serving the original URL.
    }
    next();
  }

  private setStaticHeaders(res: express.Response, filePath: string): void {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.application') {
      res.setHeader('Content-Type', 'application/x-ms-application');
      this.setNoCacheHeaders(res);
    } else if (extension === '.manifest') {
      res.setHeader('Content-Type', 'application/x-ms-manifest');
      this.setNoCacheHeaders(res);
    }
  }

  private setNoCacheHeaders(res: express.Response): void {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}
