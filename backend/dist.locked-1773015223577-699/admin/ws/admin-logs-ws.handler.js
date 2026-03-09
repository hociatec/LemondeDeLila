"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminLogsWsHandler", {
    enumerable: true,
    get: function() {
        return AdminLogsWsHandler;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _adminwsdto = require("./admin-ws.dto");
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
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminLogsWsHandler = class AdminLogsWsHandler {
    async logsDownload(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminLogsDownloadWsDto, payload ?? {});
        const linesCount = dto.lines ?? 200;
        const filter = dto.filter?.trim() ?? '';
        const logDir = this.config.get('LOG_DIR') ?? 'log';
        const resolvedDir = _path.resolve(logDir);
        let entries;
        try {
            entries = await _fs.promises.readdir(resolvedDir);
        } catch  {
            throw new _common.BadRequestException('Répertoire de logs introuvable');
        }
        const candidates = await Promise.all(entries.filter((entry)=>entry.toLowerCase().endsWith('.log')).map(async (entry)=>({
                entry,
                stat: await _fs.promises.stat(_path.join(resolvedDir, entry))
            })));
        if (!candidates.length) {
            throw new _common.BadRequestException('Aucun fichier log disponible');
        }
        candidates.sort((a, b)=>b.stat.mtimeMs - a.stat.mtimeMs);
        const latest = candidates[0];
        const content = await _fs.promises.readFile(_path.join(resolvedDir, latest.entry), 'utf-8');
        const lines = content.split(/\r?\n/);
        const filtered = filter ? lines.filter((line)=>line.includes(filter)) : lines;
        const tail = filtered.slice(-linesCount);
        return {
            type: 'admin.logs.download',
            payload: {
                file: latest.entry,
                lines: tail,
                total: filtered.length
            }
        };
    }
    constructor(validator, config){
        this.validator = validator;
        this.config = config;
    }
};
AdminLogsWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], AdminLogsWsHandler);
