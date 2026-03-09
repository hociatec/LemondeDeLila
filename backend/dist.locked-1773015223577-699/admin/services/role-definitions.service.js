"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoleDefinitionsService", {
    enumerable: true,
    get: function() {
        return RoleDefinitionsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _roledefinitionentity = require("../entities/role-definition.entity");
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
let RoleDefinitionsService = class RoleDefinitionsService {
    async onModuleInit() {
        await this.ensureSeeded();
    }
    async list() {
        if (this.cache) {
            return this.cache;
        }
        await this.ensureSeeded();
        const all = await this.repo.find();
        const definitions = all.map((row)=>({
                name: row.name,
                description: row.description,
                permissions: Array.isArray(row.permissions) ? row.permissions : []
            })).sort((a, b)=>a.name.localeCompare(b.name, 'fr'));
        this.cache = definitions;
        return definitions;
    }
    async create(definition) {
        const current = await this.list();
        if (current.some((d)=>d.name === definition.name)) {
            throw new Error(`Le rôle '${definition.name}' existe déjà.`);
        }
        await this.repo.insert({
            name: definition.name,
            description: definition.description,
            permissions: definition.permissions ?? []
        });
        this.cache = null;
    }
    async update(name, update) {
        await this.ensureSeeded();
        const current = await this.repo.findOne({
            where: {
                name
            }
        });
        if (!current) {
            throw new Error(`Rôle '${name}' introuvable.`);
        }
        const nextName = update.name ?? current.name;
        await this.repo.manager.transaction(async (manager)=>{
            if (nextName !== name) {
                const existing = await manager.findOne(_roledefinitionentity.RoleDefinitionEntity, {
                    where: {
                        name: nextName
                    }
                });
                if (existing) {
                    throw new Error(`Le rôle '${nextName}' existe déjà.`);
                }
                await manager.delete(_roledefinitionentity.RoleDefinitionEntity, {
                    name
                });
                await manager.insert(_roledefinitionentity.RoleDefinitionEntity, {
                    name: nextName,
                    description: update.description ?? current.description,
                    permissions: update.permissions ?? current.permissions ?? []
                });
                return;
            }
            await manager.update(_roledefinitionentity.RoleDefinitionEntity, {
                name
            }, {
                description: update.description ?? current.description,
                permissions: update.permissions ?? current.permissions ?? []
            });
        });
        this.cache = null;
    }
    async delete(name) {
        await this.ensureSeeded();
        const res = await this.repo.delete({
            name
        });
        if (!res.affected) {
            throw new Error(`Rôle '${name}' introuvable.`);
        }
        this.cache = null;
    }
    getDefaultDefinitions() {
        return [
            {
                name: 'ROLE_USER',
                description: 'Accès utilisateur standard, peut rejoindre et jouer aux parties.',
                permissions: [
                    'game.play',
                    'game.history',
                    'chat.read'
                ]
            },
            {
                name: 'ROLE_MODERATOR',
                description: 'Peut gérer les utilisateurs (ban/unban) et surveiller les parties.',
                permissions: [
                    'game.play',
                    'game.history',
                    'chat.read',
                    'admin.users'
                ]
            },
            {
                name: 'ROLE_ADMIN',
                description: 'Accès complet à l’administration, aux jeux et aux configurations.',
                permissions: [
                    'admin.*',
                    'game.*',
                    'log.read'
                ]
            }
        ];
    }
    async ensureSeeded() {
        const count = await this.repo.count();
        if (count > 0) return;
        const definitions = this.getDefaultDefinitions();
        await this.repo.save(definitions.filter((d)=>d?.name && d?.description).map((d)=>({
                name: d.name,
                description: d.description,
                permissions: Array.isArray(d.permissions) ? d.permissions : []
            })));
        this.cache = null;
    }
    constructor(repo){
        this.repo = repo;
        this.cache = null;
    }
};
RoleDefinitionsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_roledefinitionentity.RoleDefinitionEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], RoleDefinitionsService);
