"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get requireAdmin () {
        return requireAdmin;
    },
    get requireUser () {
        return requireUser;
    }
});
const _common = require("@nestjs/common");
function requireUser(session) {
    if (!session.user?.id) {
        throw new _common.UnauthorizedException('Authentification requise');
    }
    return session.user;
}
function requireAdmin(session) {
    const user = requireUser(session);
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const hasAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
    if (!hasAdmin) {
        throw new _common.UnauthorizedException('Rôle administrateur requis');
    }
    return user;
}
