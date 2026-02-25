"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const lila_ws_adapter_1 = require("./common/ws/lila-ws.adapter");
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const serv_logger_service_1 = require("./common/services/serv-logger.service");
const express = __importStar(require("express"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const bootstrapLogger = new common_1.Logger('bootstrap');
function buildUpdatesLandingPageHtml(updatesDir) {
    try {
        const entries = fs.readdirSync(updatesDir, { withFileTypes: true });
        const application = entries
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .find((name) => name.toLowerCase().endsWith('.application'));
        const zipName = 'client-win.zip';
        const zipExists = fs.existsSync(path.join(updatesDir, zipName));
        const links = [];
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
      ${links.length > 0
            ? links
                .map((l, idx) => `<div style="margin-top: ${idx === 0 ? 0 : 12}px;">
                     <a class="btn ${idx === 0 ? '' : 'secondary'}" href="${l.href}">${l.label}</a>
                     ${l.note ? `<div class="note">${l.note}</div>` : ''}
                   </div>`)
                .join('\n')
            : '<div>Aucun package disponible pour le moment.</div>'}
      <div class="note" style="margin-top: 16px;">
        Si l’application vous indique qu’une mise à jour est requise, installez la dernière version puis relancez.
      </div>
    </div>
  </body>
</html>`;
        return html;
    }
    catch {
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
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: new serv_logger_service_1.ServLoggerService(),
        abortOnError: false,
    });
    const config = app.get(config_1.ConfigService);
    const nodeEnv = (config.get('NODE_ENV') ||
        process.env.NODE_ENV ||
        'development').toLowerCase();
    const defaultUpdatesDir = nodeEnv === 'production'
        ? path.join(os.homedir(), '.local', 'share', 'lemonde-de-lila', 'client-updates', 'client-win')
        :
            path.resolve(__dirname, '..', 'data', 'client-updates', 'client-win');
    const updatesDir = config.get('CLIENT_UPDATES_DIR') || defaultUpdatesDir;
    if (!config.get('CLIENT_UPDATES_DIR') && nodeEnv === 'production') {
        console.warn(`[updates] CLIENT_UPDATES_DIR is not set; using resilient default path: ${updatesDir}. ` +
            `For explicit control, set CLIENT_UPDATES_DIR in the systemd environment.`);
    }
    try {
        fs.mkdirSync(updatesDir, { recursive: true });
    }
    catch {
    }
    app.use('/updates/client-win', (req, res, next) => {
        try {
            const url = typeof req?.url === 'string' ? req.url : '';
            const pathname = url.split('?')[0] || '';
            if (pathname === '' || pathname === '/' || pathname === '/index.html') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.status(200).send(buildUpdatesLandingPageHtml(updatesDir));
                return;
            }
        }
        catch {
        }
        next();
    }, (req, _res, next) => {
        try {
            if (typeof req?.url === 'string' &&
                (req.url.includes('\\') || /%5c/i.test(req.url))) {
                req.url = req.url.replace(/%5c/gi, '/').replace(/\\/g, '/');
            }
        }
        catch {
        }
        next();
    }, express.static(updatesDir, {
        setHeaders: (res, filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.application') {
                res.setHeader('Content-Type', 'application/x-ms-application');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            else if (ext === '.manifest') {
                res.setHeader('Content-Type', 'application/x-ms-manifest');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        },
    }));
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    const corsOrigins = config.get('CORS_ORIGINS');
    const origins = corsOrigins
        ? corsOrigins
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : null;
    app.enableCors({
        origin: origins && origins.length > 0
            ? origins
            : nodeEnv === 'production'
                ? false
                : true,
        credentials: origins && origins.length > 0,
    });
    app.useWebSocketAdapter(new lila_ws_adapter_1.LilaWsAdapter(app));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = config.get('PORT', 3000);
    await app.listen(port);
    bootstrapLogger.log(`listening on ${port}`);
}
bootstrap().catch((err) => {
    console.error('bootstrap failed', err instanceof Error ? err.stack : String(err));
    bootstrapLogger.error('failed', err instanceof Error ? err.stack : String(err));
    process.exit(1);
});
//# sourceMappingURL=main.js.map