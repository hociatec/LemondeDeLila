"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUser = requireUser;
exports.requireAdmin = requireAdmin;
const common_1 = require("@nestjs/common");
function requireUser(session) {
    if (!session.user?.id) {
        throw new common_1.UnauthorizedException('Authentification requise');
    }
    return session.user;
}
function requireAdmin(session) {
    const user = requireUser(session);
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const hasAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
    if (!hasAdmin) {
        throw new common_1.UnauthorizedException('Rôle administrateur requis');
    }
    return user;
}
//# sourceMappingURL=ws-auth.js.map