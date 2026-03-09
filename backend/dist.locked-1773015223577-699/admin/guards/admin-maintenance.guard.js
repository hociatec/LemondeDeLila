"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminMaintenanceGuard", {
    enumerable: true,
    get: function() {
        return AdminMaintenanceGuard;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let AdminMaintenanceGuard = class AdminMaintenanceGuard {
    canActivate(context) {
        if (!this.isEnabled()) {
            throw new _common.ForbiddenException('Maintenance désactivée sur ce serveur');
        }
        const request = context.switchToHttp().getRequest();
        if (this.isTokenRequired()) {
            const token = String(request?.headers?.['x-admin-maintenance-token'] || '').trim();
            const expected = String(process.env.ADMIN_MAINTENANCE_TOKEN || '').trim();
            if (!expected) {
                throw new _common.ForbiddenException('Maintenance non configurée (token manquant)');
            }
            if (!token || token !== expected) {
                throw new _common.ForbiddenException('Token de maintenance invalide');
            }
        }
        const ipAllowlist = this.getIpAllowlist();
        if (ipAllowlist.length > 0) {
            const ip = this.getRequestIp(request);
            if (!ip || !ipAllowlist.includes(ip)) {
                throw new _common.ForbiddenException('IP non autorisée pour la maintenance');
            }
        }
        return true;
    }
    isEnabled() {
        const raw = String(process.env.ADMIN_MAINTENANCE_ENABLED || '').trim().toLowerCase();
        return raw === '1' || raw === 'true' || raw === 'yes';
    }
    isTokenRequired() {
        const raw = String(process.env.ADMIN_MAINTENANCE_REQUIRE_TOKEN || '').trim().toLowerCase();
        if (!raw) return true; // default: required
        return !(raw === '0' || raw === 'false' || raw === 'no');
    }
    getIpAllowlist() {
        const raw = String(process.env.ADMIN_MAINTENANCE_ALLOWED_IPS || '').trim();
        if (!raw) return [];
        return raw.split(',').map((s)=>s.trim()).filter(Boolean);
    }
    getRequestIp(request) {
        const forwarded = String(request.headers['x-forwarded-for'] || '').trim();
        const ip = forwarded ? forwarded.split(',')[0]?.trim() : String(request.ip || '').trim();
        if (!ip) return null;
        // Normalize "::ffff:1.2.3.4" style addresses.
        return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
    }
};
AdminMaintenanceGuard = _ts_decorate([
    (0, _common.Injectable)()
], AdminMaintenanceGuard);
