"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminBroadcastWsHandler = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const notification_service_1 = require("../../notification/services/notification.service");
const user_entity_1 = require("../../user/entities/user.entity");
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminBroadcastWsHandler = class AdminBroadcastWsHandler {
    validator;
    notifications;
    userRepo;
    constructor(validator, notifications, userRepo) {
        this.validator = validator;
        this.notifications = notifications;
        this.userRepo = userRepo;
    }
    async broadcast(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminBroadcastWsDto, payload);
        const message = dto.message.trim();
        const ids = await this.userRepo
            .createQueryBuilder('u')
            .select(['u.id'])
            .getMany();
        const payloadOut = {
            message,
            fromUserId: admin.id,
            fromUsername: admin.username,
            timestamp: new Date().toISOString(),
        };
        await Promise.all(ids.map((u) => this.notifications.notifyUser(u.id, 'admin.broadcast', payloadOut)));
        return { type: 'admin.broadcast', payload: { delivered: ids.length } };
    }
};
exports.AdminBroadcastWsHandler = AdminBroadcastWsHandler;
exports.AdminBroadcastWsHandler = AdminBroadcastWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        notification_service_1.NotificationService,
        typeorm_2.Repository])
], AdminBroadcastWsHandler);
//# sourceMappingURL=admin-broadcast-ws.handler.js.map