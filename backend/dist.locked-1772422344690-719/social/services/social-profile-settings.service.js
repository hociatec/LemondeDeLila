"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialProfileSettingsService", {
    enumerable: true,
    get: function() {
        return SocialProfileSettingsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _socialprofilesettingsentity = require("../entities/social-profile-settings.entity");
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
const BioHardMaxLength = 100000;
let SocialProfileSettingsService = class SocialProfileSettingsService {
    async onModuleInit() {
        await this.ensureSeeded();
    }
    defaults() {
        const min = Number.parseInt((process.env.PROFILE_BIO_MIN_LENGTH || '0').trim(), 10);
        const max = Number.parseInt((process.env.PROFILE_BIO_MAX_LENGTH || '500').trim(), 10);
        return this.normalize({
            bioMinLength: min,
            bioMaxLength: max
        });
    }
    normalize(input) {
        const min = Number.isFinite(input.bioMinLength) ? Math.max(0, Math.floor(input.bioMinLength)) : 0;
        const max = Number.isFinite(input.bioMaxLength) ? Math.max(0, Math.min(BioHardMaxLength, Math.floor(input.bioMaxLength))) : 500;
        const clampedMin = Math.min(min, max);
        return {
            bioMinLength: clampedMin,
            bioMaxLength: max
        };
    }
    get() {
        return this.cache ?? this.defaults();
    }
    async update(patch) {
        await this.ensureSeeded();
        const current = this.get();
        const next = this.normalize({
            ...current,
            ...patch
        });
        await this.repo.save({
            id: 1,
            bioMinLength: next.bioMinLength,
            bioMaxLength: next.bioMaxLength
        });
        this.cache = next;
        return next;
    }
    async ensureSeeded() {
        if (this.cache) return;
        const existing = await this.repo.findOne({
            where: {
                id: 1
            }
        });
        if (existing) {
            this.cache = this.normalize({
                bioMinLength: existing.bioMinLength,
                bioMaxLength: existing.bioMaxLength
            });
            return;
        }
        const seed = this.defaults();
        await this.repo.insert({
            id: 1,
            bioMinLength: seed.bioMinLength,
            bioMaxLength: seed.bioMaxLength
        });
        this.cache = seed;
    }
    constructor(repo){
        this.repo = repo;
        this.cache = null;
    }
};
SocialProfileSettingsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_socialprofilesettingsentity.SocialProfileSettingsEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], SocialProfileSettingsService);
