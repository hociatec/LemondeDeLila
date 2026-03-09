"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _core = require("@nestjs/core");
const _common = require("@nestjs/common");
const _lilawsadapter = require("./common/ws/lila-ws.adapter");
const _helmet = /*#__PURE__*/ _interop_require_default(require("helmet"));
const _compression = /*#__PURE__*/ _interop_require_default(require("compression"));
const _config = require("@nestjs/config");
const _appmodule = require("./app.module");
const _servloggerservice = require("./common/services/serv-logger.service");
const _express = /*#__PURE__*/ _interop_require_wildcard(require("express"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const bootstrapLogger = new _common.Logger('bootstrap');
function buildUpdatesLandingPageHtml(updatesDir) {
    try {
        const entries = _fs.readdirSync(updatesDir, {
            withFileTypes: true
        });
        const application = entries.filter((e)=>e.isFile()).map((e)=>e.name).find((name)=>name.toLowerCase().endsWith('.application'));
        const zipName = 'client-win.zip';
        const zipExists = _fs.existsSync(_path.join(updatesDir, zipName));
        const links = [];
        if (zipExists) {
            links.push({
                href: zipName,
                label: 'Télécharger (ZIP)',
                note: 'Version portable (à extraire).'
            });
        }
        if (application) {
            links.push({
                href: application,
                label: 'Installer / Mettre à jour (ClickOnce)',
                note: 'Si vous utilisez ClickOnce.'
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
      ${links.length > 0 ? links.map((l, idx)=>`<div style="margin-top: ${idx === 0 ? 0 : 12}px;">
                     <a class="btn ${idx === 0 ? '' : 'secondary'}" href="${l.href}">${l.label}</a>
                     ${l.note ? `<div class="note">${l.note}</div>` : ''}
                   </div>`).join('\n') : '<div>Aucun package disponible pour le moment.</div>'}
      <div class="note" style="margin-top: 16px;">
        Si l’application vous indique qu’une mise à jour est requise, installez la dernière version puis relancez.
      </div>
    </div>
  </body>
</html>`;
        return html;
    } catch  {
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
    const app = await _core.NestFactory.create(_appmodule.AppModule, {
        logger: new _servloggerservice.ServLoggerService(),
        // Important: let errors bubble so our bootstrap().catch can log them.
        // Otherwise Nest may abort via ExceptionsZone and exit(1) without any useful output.
        abortOnError: false
    });
    const config = app.get(_config.ConfigService);
    // Static hosting for ClickOnce client updates through the existing API virtual host.
    // Nginx currently proxies all paths to the backend, so we serve /updates/* here.
    const nodeEnv = (config.get('NODE_ENV') || process.env.NODE_ENV || 'development').toLowerCase();
    const defaultUpdatesDir = nodeEnv === 'production' ? _path.join(_os.homedir(), '.local', 'share', 'lemonde-de-lila', 'client-updates', 'client-win') : // Keep a stable default path relative to the backend project root.
    _path.resolve(__dirname, '..', 'data', 'client-updates', 'client-win');
    const updatesDir = config.get('CLIENT_UPDATES_DIR') || defaultUpdatesDir;
    if (!config.get('CLIENT_UPDATES_DIR') && nodeEnv === 'production') {
        console.warn(`[updates] CLIENT_UPDATES_DIR is not set; using resilient default path: ${updatesDir}. ` + `For explicit control, set CLIENT_UPDATES_DIR in the systemd environment.`);
    }
    try {
        _fs.mkdirSync(updatesDir, {
            recursive: true
        });
    } catch  {
    /* ignore */ }
    // Landing page is generated dynamically (no filesystem writes).
    app.use('/updates/client-win', // ClickOnce manifeste utilise souvent des chemins Windows (backslashes).
    // Si le client demande des URLs contenant "\" ou "%5C", normaliser vers "/" pour éviter
    // des 404 qui se traduisent côté ClickOnce par "Des fichiers manquent".
    (req, res, next)=>{
        try {
            const url = typeof req?.url === 'string' ? req.url : '';
            const pathname = url.split('?')[0] || '';
            if (pathname === '' || pathname === '/' || pathname === '/index.html') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                // ClickOnce should always revalidate this page/manifest in case a new version is published.
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.status(200).send(buildUpdatesLandingPageHtml(updatesDir));
                return;
            }
        } catch  {
        // ignore (best-effort)
        }
        next();
    }, (req, _res, next)=>{
        try {
            if (typeof req?.url === 'string' && (req.url.includes('\\') || /%5c/i.test(req.url))) {
                req.url = req.url.replace(/%5c/gi, '/').replace(/\\/g, '/');
            }
        } catch  {
        // ignore
        }
        next();
    }, _express.static(updatesDir, {
        setHeaders: (res, filePath)=>{
            const ext = _path.extname(filePath).toLowerCase();
            if (ext === '.application') {
                res.setHeader('Content-Type', 'application/x-ms-application');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            } else if (ext === '.manifest') {
                res.setHeader('Content-Type', 'application/x-ms-manifest');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        }
    }));
    app.use((0, _helmet.default)());
    app.use((0, _compression.default)());
    const corsOrigins = config.get('CORS_ORIGINS');
    const origins = corsOrigins ? corsOrigins.split(',').map((origin)=>origin.trim()).filter(Boolean) : null;
    app.enableCors({
        origin: origins && origins.length > 0 ? origins : nodeEnv === 'production' ? false : true,
        credentials: origins && origins.length > 0
    });
    app.useWebSocketAdapter(new _lilawsadapter.LilaWsAdapter(app));
    app.useGlobalPipes(new _common.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    }));
    const port = config.get('PORT', 3000);
    await app.listen(port);
    bootstrapLogger.log(`listening on ${port}`);
}
bootstrap().catch((err)=>{
    // Fallback: ensure we see the failure even if the Nest logger is not flushed/displayed.
    console.error('bootstrap failed', err instanceof Error ? err.stack : String(err));
    bootstrapLogger.error('failed', err instanceof Error ? err.stack : String(err));
    process.exit(1);
});
