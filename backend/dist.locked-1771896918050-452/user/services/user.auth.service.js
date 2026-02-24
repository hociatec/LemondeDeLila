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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var UserAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("@nestjs/config");
const user_entity_1 = require("../entities/user.entity");
const jwt_config_1 = require("../../common/auth/jwt-config");
let UserAuthService = UserAuthService_1 = class UserAuthService {
    users;
    config;
    logger = new common_1.Logger(UserAuthService_1.name);
    jwtSigningKey;
    jwtAlgorithm;
    jwtExpiresIn;
    jwtIssuer;
    jwtAudience;
    constructor(users, config) {
        this.users = users;
        this.config = config;
        this.jwtSigningKey = (0, jwt_config_1.requireJwtSigningKey)(this.config);
        this.jwtAlgorithm = (0, jwt_config_1.getJwtAlgorithm)(this.config);
        this.jwtExpiresIn = this.config.get('JWT_EXPIRES_IN', '12h');
        this.jwtIssuer = this.config.get('JWT_ISSUER', 'le-monde-de-lila');
        const aud = this.config.get('JWT_AUDIENCE');
        this.jwtAudience = aud && aud.trim() ? aud.trim() : undefined;
    }
    async register(email, username, password) {
        const normalizedEmail = email.toLowerCase();
        await this.ensureUsernameAvailable(username);
        await this.ensureEmailAvailable(normalizedEmail);
        if (!password || password.trim() === '') {
            throw new common_1.BadRequestException('Mot de passe requis');
        }
        const hash = await bcrypt.hash(password, 10);
        const user = this.users.create({
            email: normalizedEmail,
            username,
            password: hash,
            roles: [],
            avatar: null,
            emailVerified: true,
        });
        await this.users.save(user);
    }
    async login(username, password) {
        const user = await this.users.findOne({ where: { username } });
        if (!user) {
            throw new common_1.UnauthorizedException('Identifiants invalides');
        }
        const hash = user.password || '';
        const normalizedHash = hash.startsWith('$2y$')
            ? '$2b$' + hash.substring(4)
            : hash;
        let ok = false;
        try {
            ok = await bcrypt.compare(password, normalizedHash);
        }
        catch (err) {
            this.logger.error('Erreur bcrypt.compare', err instanceof Error ? err.stack : String(err));
            throw new common_1.UnauthorizedException('Identifiants invalides');
        }
        if (!ok) {
            throw new common_1.UnauthorizedException('Identifiants invalides');
        }
        if (!user.emailVerified) {
            throw new common_1.UnauthorizedException('Email non vérifié');
        }
        if (user.bannedUntil && user.bannedUntil.getTime() <= Date.now()) {
            user.bannedUntil = null;
            user.banReason = null;
            try {
                await this.users.save(user);
            }
            catch {
            }
        }
        if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
            const until = formatDateFr(user.bannedUntil);
            const banReason = this.sanitizeBanReason(user.banReason);
            const reason = banReason ? ` (motif : ${banReason})` : '';
            throw new common_1.UnauthorizedException(`Compte banni jusqu'au ${until}${reason}`);
        }
        const token = jwt.sign({
            username: user.username,
            roles: user.roles?.length ? user.roles : ['ROLE_USER'],
            email: user.email,
            id: user.id,
        }, this.jwtSigningKey, (() => {
            const options = {
                algorithm: this.jwtAlgorithm,
                expiresIn: this.jwtExpiresIn,
                issuer: this.jwtIssuer,
                subject: String(user.id),
            };
            if (this.jwtAudience) {
                options.audience = this.jwtAudience;
            }
            return options;
        })());
        return { token };
    }
    _banReasonWhitespace = /\s+/g;
    sanitizeBanReason(reason) {
        if (!reason)
            return null;
        const normalized = String(reason)
            .replace(this._banReasonWhitespace, ' ')
            .trim();
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
            'team',
        ];
        if (reserved.includes(username.toLowerCase())) {
            throw new common_1.BadRequestException('Ce nom d’utilisateur est réservé');
        }
        const exists = await this.users.findOne({ where: { username } });
        if (exists) {
            throw new common_1.ConflictException('Nom d’utilisateur déjà utilisé');
        }
    }
    async ensureEmailAvailable(email) {
        const exists = await this.users.findOne({ where: { email } });
        if (exists) {
            throw new common_1.ConflictException('Email déjà enregistré');
        }
    }
};
exports.UserAuthService = UserAuthService;
exports.UserAuthService = UserAuthService = UserAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], UserAuthService);
function formatDateFr(date) {
    const iso = date.toISOString().slice(0, 10);
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
//# sourceMappingURL=user.auth.service.js.map