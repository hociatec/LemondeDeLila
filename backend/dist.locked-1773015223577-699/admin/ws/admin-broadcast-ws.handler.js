"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminBroadcastWsHandler", {
    enumerable: true,
    get: function() {
        return AdminBroadcastWsHandler;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _notificationservice = require("../../notification/services/notification.service");
const _userentity = require("../../user/entities/user.entity");
const _adminwsdto = require("./admin-ws.dto");
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
let AdminBroadcastWsHandler = class AdminBroadcastWsHandler {
    async broadcast(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminBroadcastWsDto, payload);
        const message = dto.message.trim();
        const ids = await this.userRepo.createQueryBuilder('u').select([
            'u.id'
        ]).getMany();
        const payloadOut = {
            message,
            fromUserId: admin.id,
            fromUsername: admin.username,
            timestamp: new Date().toISOString()
        };
        await Promise.all(ids.map((u)=>this.notifications.notifyUser(u.id, 'admin.broadcast', payloadOut)));
        return {
            type: 'admin.broadcast',
            payload: {
                delivered: ids.length
            }
        };
    }
    constructor(validator, notifications, userRepo){
        this.validator = validator;
        this.notifications = notifications;
        this.userRepo = userRepo;
    }
};
AdminBroadcastWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(2, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], AdminBroadcastWsHandler);
