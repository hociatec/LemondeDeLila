"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtAlgorithm = getJwtAlgorithm;
exports.requireJwtSigningKey = requireJwtSigningKey;
exports.requireJwtVerifyKey = requireJwtVerifyKey;
exports.getJwtVerifyAlgorithms = getJwtVerifyAlgorithms;
const common_1 = require("@nestjs/common");
function normalizeAlgorithm(value) {
    const v = (value || '').trim().toUpperCase();
    if (v === 'HS256' || v === 'RS256')
        return v;
    return null;
}
function getJwtAlgorithm(config) {
    const explicit = normalizeAlgorithm(config.get('JWT_ALGORITHM'));
    if (explicit)
        return explicit;
    const hasRsa = !!config.get('JWT_PRIVATE_KEY_PEM') ||
        !!config.get('JWT_PRIVATE_KEY_PATH') ||
        !!config.get('JWT_PUBLIC_KEY_PEM') ||
        !!config.get('JWT_PUBLIC_KEY_PATH');
    return hasRsa ? 'RS256' : 'HS256';
}
function readKeyFromPath(path) {
    try {
        const fs = require('fs');
        return fs.readFileSync(path, 'utf8');
    }
    catch {
        throw new common_1.UnauthorizedException('Configuration JWT manquante');
    }
}
function requireJwtSigningKey(config) {
    const alg = getJwtAlgorithm(config);
    if (alg === 'HS256') {
        const secret = config.get('JWT_SECRET');
        if (!secret || !secret.trim()) {
            throw new common_1.UnauthorizedException('Configuration JWT manquante');
        }
        return secret;
    }
    const pem = config.get('JWT_PRIVATE_KEY_PEM') ||
        (config.get('JWT_PRIVATE_KEY_PATH')
            ? readKeyFromPath(config.get('JWT_PRIVATE_KEY_PATH'))
            : null);
    if (!pem || !pem.trim()) {
        throw new common_1.UnauthorizedException('Configuration JWT manquante');
    }
    return pem;
}
function requireJwtVerifyKey(config) {
    const alg = getJwtAlgorithm(config);
    if (alg === 'HS256') {
        const secret = config.get('JWT_SECRET');
        if (!secret || !secret.trim()) {
            throw new common_1.UnauthorizedException('Configuration JWT manquante');
        }
        return secret;
    }
    const pem = config.get('JWT_PUBLIC_KEY_PEM') ||
        (config.get('JWT_PUBLIC_KEY_PATH')
            ? readKeyFromPath(config.get('JWT_PUBLIC_KEY_PATH'))
            : null);
    if (!pem || !pem.trim()) {
        throw new common_1.UnauthorizedException('Configuration JWT manquante');
    }
    return pem;
}
function getJwtVerifyAlgorithms(config) {
    const alg = getJwtAlgorithm(config);
    return [alg];
}
//# sourceMappingURL=jwt-config.js.map