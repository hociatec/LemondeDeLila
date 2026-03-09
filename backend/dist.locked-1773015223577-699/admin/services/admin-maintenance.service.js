"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminMaintenanceService", {
    enumerable: true,
    get: function() {
        return AdminMaintenanceService;
    }
});
const _common = require("@nestjs/common");
const _nodechild_process = require("node:child_process");
const _nodehttp = /*#__PURE__*/ _interop_require_wildcard(require("node:http"));
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
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
const DEPLOY_UNIT = process.env.ADMIN_MAINTENANCE_DEPLOY_UNIT || 'lila-backend-deploy.service';
const BACKEND_SERVICE = process.env.ADMIN_MAINTENANCE_BACKEND_SERVICE || 'lila-backend.service';
const SERVICE_RE = /^[a-zA-Z0-9@._-]+$/;
let AdminMaintenanceService = class AdminMaintenanceService {
    startBuildAndRestartBackend() {
        if (!SERVICE_RE.test(BACKEND_SERVICE)) {
            throw new _common.InternalServerErrorException({
                message: `Service backend invalide: ${BACKEND_SERVICE}`
            });
        }
        // IMPORTANT: on planifie après la réponse HTTP.
        // On build d'abord, puis on restart le service. Si le build échoue, le service n'est pas touché.
        const chain = [
            `cd ${this.shQuote(this.backendCwd)}`,
            'npm run build',
            `sudo -n systemctl restart ${this.shQuote(BACKEND_SERVICE)}`
        ].join(' && ');
        this.spawnDetached([
            'bash',
            '-lc',
            chain
        ], {
            delayMs: 350
        });
        return {
            ok: true,
            service: BACKEND_SERVICE,
            scheduled: true
        };
    }
    startDeploy() {
        const res = this.run([
            'sudo',
            '-n',
            'systemctl',
            'start',
            '--no-block',
            DEPLOY_UNIT
        ]);
        if (res.status !== 0) {
            throw new _common.InternalServerErrorException({
                message: 'Échec du déclenchement du déploiement',
                details: res
            });
        }
        return {
            ok: true,
            unit: DEPLOY_UNIT
        };
    }
    startRestartBackend() {
        // IMPORTANT: on planifie le restart après la réponse HTTP,
        // sinon la connexion du client est coupée avant d'avoir reçu un ACK.
        this.spawnDetached([
            'sudo',
            '-n',
            'systemctl',
            'restart',
            BACKEND_SERVICE
        ], {
            delayMs: 350
        });
        return {
            ok: true,
            service: BACKEND_SERVICE,
            scheduled: true
        };
    }
    daemonReload() {
        const res = this.run([
            'sudo',
            '-n',
            'systemctl',
            'daemon-reload'
        ]);
        if (res.status !== 0) {
            throw new _common.InternalServerErrorException({
                message: `Échec systemd daemon-reload`,
                details: res
            });
        }
        return {
            ok: true,
            command: 'systemctl daemon-reload',
            ...res
        };
    }
    dryRunBuild() {
        const res = this.run([
            'npm',
            'run',
            'build'
        ], {
            cwd: this.backendCwd,
            timeoutMs: 10 * 60 * 1000
        });
        if (res.status !== 0) {
            throw new _common.InternalServerErrorException({
                message: `Build échoué (dry-run)`,
                details: res
            });
        }
        return {
            ok: true,
            command: 'npm run build',
            ...res
        };
    }
    runMigrations() {
        const res = this.run([
            'npm',
            'run',
            'migration:run'
        ], {
            cwd: this.backendCwd,
            timeoutMs: 10 * 60 * 1000
        });
        if (res.status !== 0) {
            throw new _common.InternalServerErrorException({
                message: `Migrations échouées`,
                details: res
            });
        }
        return {
            ok: true,
            command: 'npm run migration:run',
            ...res
        };
    }
    async getHealth() {
        const port = Number(process.env.PORT || 3000);
        const url = `http://127.0.0.1:${port}/health`;
        const res = await this.httpGet(url, 3500);
        return {
            ok: true,
            url,
            statusCode: res.statusCode,
            body: res.body
        };
    }
    getDeployStatus() {
        return this.getUnitStatus(DEPLOY_UNIT);
    }
    getBackendServiceStatus() {
        return this.getUnitStatus(BACKEND_SERVICE);
    }
    getDeployLogs(input) {
        const tail = this.parseTail(input.tail);
        const res = this.run([
            'sudo',
            '-n',
            'journalctl',
            '-u',
            DEPLOY_UNIT,
            '--no-pager',
            '-o',
            'short-iso',
            '-n',
            String(tail)
        ]);
        if (res.status !== 0) {
            throw new _common.InternalServerErrorException({
                message: 'Impossible de lire les logs du déploiement',
                details: res
            });
        }
        return {
            ok: true,
            unit: DEPLOY_UNIT,
            tail,
            logs: res.stdout
        };
    }
    getUnitStatus(unit) {
        const res = this.run([
            'sudo',
            '-n',
            'systemctl',
            'show',
            unit,
            '--no-pager',
            '--property=Id,ActiveState,SubState,Result,ExecMainStatus,ExecMainCode,ExecMainStartTimestamp,ExecMainExitTimestamp'
        ]);
        if (res.status !== 0) {
            throw new _common.InternalServerErrorException({
                message: `Impossible de lire le status systemd: ${unit}`,
                details: res
            });
        }
        const props = this.parseSystemctlShow(res.stdout);
        return {
            ok: true,
            unit,
            ...props
        };
    }
    parseSystemctlShow(raw) {
        const lines = String(raw || '').split(/\r?\n/).map((l)=>l.trim()).filter(Boolean);
        const out = {};
        for (const line of lines){
            const idx = line.indexOf('=');
            if (idx <= 0) continue;
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 1).trim();
            out[key] = val;
        }
        return out;
    }
    parseTail(rawTail) {
        const n = Number.parseInt(String(rawTail || ''), 10);
        if (!Number.isFinite(n) || n <= 0) return 200;
        return Math.max(1, Math.min(2000, n));
    }
    run(argv, opts) {
        const [cmd, ...args] = argv;
        const result = (0, _nodechild_process.spawnSync)(cmd, args, {
            encoding: 'utf8',
            env: process.env,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
            cwd: opts?.cwd,
            timeout: opts?.timeoutMs
        });
        return {
            status: typeof result.status === 'number' ? result.status : 1,
            stdout: String(result.stdout || ''),
            stderr: String(result.stderr || ''),
            error: result.error ? String(result.error.message || result.error) : null
        };
    }
    spawnDetached(argv, opts) {
        const delayMs = typeof opts?.delayMs === 'number' ? opts.delayMs : 0;
        setTimeout(()=>{
            try {
                const [cmd, ...args] = argv;
                const child = (0, _nodechild_process.spawn)(cmd, args, {
                    cwd: opts?.cwd,
                    env: process.env,
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true
                });
                child.unref();
            } catch  {
            // best effort
            }
        }, Math.max(0, delayMs));
    }
    shQuote(value) {
        const raw = String(value ?? '');
        // Single-quote safe for bash: ' -> '\''
        return `'${raw.replaceAll("'", `'\\''`)}'`;
    }
    httpGet(url, timeoutMs) {
        return new Promise((resolve)=>{
            try {
                const req = _nodehttp.get(url, (res)=>{
                    const statusCode = typeof res.statusCode === 'number' ? res.statusCode : 0;
                    res.setEncoding('utf8');
                    let body = '';
                    res.on('data', (chunk)=>body += chunk);
                    res.on('end', ()=>resolve({
                            statusCode,
                            body
                        }));
                });
                req.on('error', ()=>resolve({
                        statusCode: 0,
                        body: ''
                    }));
                req.setTimeout(timeoutMs, ()=>{
                    try {
                        req.destroy();
                    } catch  {
                    /* ignore */ }
                    resolve({
                        statusCode: 0,
                        body: ''
                    });
                });
            } catch  {
                resolve({
                    statusCode: 0,
                    body: ''
                });
            }
        });
    }
    constructor(){
        this.backendCwd = process.cwd();
    }
};
AdminMaintenanceService = _ts_decorate([
    (0, _common.Injectable)()
], AdminMaintenanceService);
