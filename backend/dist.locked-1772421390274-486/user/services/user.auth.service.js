"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "UserAuthService", {
    enumerable: true,
    get: function() {
        return UserAuthService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _bcrypt = /*#__PURE__*/ _interop_require_wildcard(require("bcrypt"));
const _jsonwebtoken = /*#__PURE__*/ _interop_require_wildcard(require("jsonwebtoken"));
const _config = require("@nestjs/config");
const _userentity = require("../entities/user.entity");
const _jwtconfig = require("../../common/auth/jwt-config");
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
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let UserAuthService = class UserAuthService {
    async register(email, username, password) {
        const normalizedEmail = email.toLowerCase();
        await this.ensureUsernameAvailable(username);
        await this.ensureEmailAvailable(normalizedEmail);
        if (!password || password.trim() === '') {
            throw new _common.BadRequestException('Mot de passe requis');
        }
        const hash = await _bcrypt.hash(password, 10);
        const user = this.users.create({
            email: normalizedEmail,
            username,
            password: hash,
            roles: [],
            avatar: null,
            emailVerified: true
        });
        await this.users.save(user);
    }
    async login(username, password) {
        const user = await this.users.findOne({
            where: {
                username
            }
        });
        if (!user) {
            throw new _common.UnauthorizedException('Identifiants invalides');
        }
        const hash = user.password || '';
        const normalizedHash = hash.startsWith('$2y$') ? '$2b$' + hash.substring(4) : hash;
        let ok = false;
        try {
            ok = await _bcrypt.compare(password, normalizedHash);
        } catch (err) {
            // En cas de hash invalide ou corruption, on log et on renvoie 401 générique
            this.logger.error('Erreur bcrypt.compare', err instanceof Error ? err.stack : String(err));
            throw new _common.UnauthorizedException('Identifiants invalides');
        }
        if (!ok) {
            throw new _common.UnauthorizedException('Identifiants invalides');
        }
        if (!user.emailVerified) {
            throw new _common.UnauthorizedException('Email non vérifié');
        }
        // Auto-unban: si la date de ban est passée, nettoyer les champs pour que l'admin ne voie plus "banni".
        if (user.bannedUntil && user.bannedUntil.getTime() <= Date.now()) {
            user.bannedUntil = null;
            user.banReason = null;
            try {
                await this.users.save(user);
            } catch  {
            // best-effort: don't block login for a cleanup failure
            }
        }
        if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
            const until = formatDateFr(user.bannedUntil);
            const banReason = this.sanitizeBanReason(user.banReason);
            const reason = banReason ? ` (motif : ${banReason})` : '';
            throw new _common.UnauthorizedException(`Compte banni jusqu'au ${until}${reason}`);
        }
        const token = _jsonwebtoken.sign({
            username: user.username,
            roles: user.roles?.length ? user.roles : [
                'ROLE_USER'
            ],
            email: user.email,
            id: user.id
        }, this.jwtSigningKey, (()=>{
            const options = {
                algorithm: this.jwtAlgorithm,
                expiresIn: this.jwtExpiresIn,
                issuer: this.jwtIssuer,
                subject: String(user.id)
            };
            if (this.jwtAudience) {
                options.audience = this.jwtAudience;
            }
            return options;
        })());
        return {
            token
        };
    }
    sanitizeBanReason(reason) {
        if (!reason) return null;
        const normalized = String(reason).replace(this._banReasonWhitespace, ' ').trim();
        return normalized ? normalized : null;
    }
    async ensureUsernameAvailable(username) {
        const reserved = [
            'admin',
            'root',
            'system',
            'bot',
            'moderator',
            'mod',
            'administrator',
            'support',
            'help',
            'api',
            'test',
            'user',
            'guest',
            'anonymous',
            'null',
            'undefined',
            'server',
            'official',
            'staff',
            'team'
        ];
        if (reserved.includes(username.toLowerCase())) {
            throw new _common.BadRequestException('Ce nom d’utilisateur est réservé');
        }
        const exists = await this.users.findOne({
            where: {
                username
            }
        });
        if (exists) {
            throw new _common.ConflictException('Nom d’utilisateur déjà utilisé');
        }
    }
    async ensureEmailAvailable(email) {
        const exists = await this.users.findOne({
            where: {
                email
            }
        });
        if (exists) {
            throw new _common.ConflictException('Email déjà enregistré');
        }
    }
    constructor(users, config){
        this.users = users;
        this.config = config;
        this.logger = new _common.Logger(UserAuthService.name);
        this._banReasonWhitespace = /\s+/g;
        this.jwtSigningKey = (0, _jwtconfig.requireJwtSigningKey)(this.config);
        this.jwtAlgorithm = (0, _jwtconfig.getJwtAlgorithm)(this.config);
        this.jwtExpiresIn = this.config.get('JWT_EXPIRES_IN', '12h');
        this.jwtIssuer = this.config.get('JWT_ISSUER', 'le-monde-de-lila');
        const aud = this.config.get('JWT_AUDIENCE');
        this.jwtAudience = aud && aud.trim() ? aud.trim() : undefined;
    }
};
UserAuthService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], UserAuthService);
function formatDateFr(date) {
    // Use UTC date to avoid timezone shifting in display.
    const iso = date.toISOString().slice(0, 10); // yyyy-MM-dd
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
