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
exports.AdminClientUpdatesWsHandler = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const notification_service_1 = require("../../notification/services/notification.service");
const user_entity_1 = require("../../user/entities/user.entity");
const client_updates_service_1 = require("../../client-updates/services/client-updates.service");
const version_utils_1 = require("../../common/utils/version.utils");
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminClientUpdatesWsHandler = class AdminClientUpdatesWsHandler {
    validator;
    notifications;
    clientUpdates;
    userRepo;
    scheduledTimer = null;
    scheduledAtMs = null;
    warningTimer = null;
    warningAtMs = null;
    constructor(validator, notifications, clientUpdates, userRepo) {
        this.validator = validator;
        this.notifications = notifications;
        this.clientUpdates = clientUpdates;
        this.userRepo = userRepo;
    }
    async clientUpdateAnnounce(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminClientUpdateAnnounceWsDto, payload);
        const latest = await this.clientUpdates.getLatest();
        const ids = await this.userRepo
            .createQueryBuilder('u')
            .select(['u.id'])
            .getMany();
        const recipients = ids;
        const message = typeof dto.message === 'string' && dto.message.trim().length > 0
            ? dto.message.trim()
            : 'Une mise à jour du client est disponible.';
        const payloadOut = {
            message,
            version: latest?.version?.trim() || dto.version?.trim() || null,
            fromUserId: admin.id,
            fromUsername: admin.username,
            timestamp: new Date().toISOString(),
        };
        await Promise.all(recipients.map((u) => this.notifications.notifyUser(u.id, 'client.update.available', payloadOut)));
        return {
            type: 'admin.client.update.announce',
            payload: { delivered: recipients.length },
        };
    }
    async clientUpdateForceLatest(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminClientUpdateForceLatestWsDto, payload ?? {});
        const latest = await this.clientUpdates.getLatest();
        const publishedClickOnce = await this.clientUpdates.getPublishedClickOnceVersionFromDisk();
        const latestVersion = (publishedClickOnce || latest?.version || '').trim() || null;
        if (!latestVersion) {
            throw new common_1.BadRequestException('Impossible de forcer la mise à jour : aucune version publiée (latest.json manquant).');
        }
        const message = typeof dto.message === 'string' && dto.message.trim().length > 0
            ? dto.message.trim()
            : 'Une mise à jour du client est requise pour continuer.';
        await this.clientUpdates.saveLatest({
            version: latestVersion,
            publishedAt: latest?.publishedAt ?? new Date().toISOString(),
            message: latest?.message ?? null,
            publicUrl: latest?.publicUrl ?? null,
            minRequiredVersion: latestVersion,
        });
        const ids = await this.userRepo
            .createQueryBuilder('u')
            .select(['u.id'])
            .getMany();
        const recipients = ids;
        const url = this.clientUpdates.resolveClientPublicUrl(latest);
        const payloadOut = {
            minRequiredVersion: latestVersion,
            currentVersion: null,
            message,
            publishedAt: latest?.publishedAt ?? null,
            url,
            fromUserId: admin.id,
            fromUsername: admin.username,
            timestamp: new Date().toISOString(),
        };
        await Promise.all(recipients.map((u) => this.notifications.notifyUser(u.id, 'client.update.required', payloadOut)));
        return {
            type: 'admin.client.update.forceLatest',
            payload: {
                delivered: recipients.length,
                minRequiredVersion: latestVersion,
            },
        };
    }
    async clientUpdateSchedule(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminClientUpdateScheduleWsDto, payload);
        const minutesFromDto = typeof dto.delayMinutes === 'number' && Number.isFinite(dto.delayMinutes)
            ? dto.delayMinutes
            : null;
        const secondsFromDto = typeof dto.delaySeconds === 'number' && Number.isFinite(dto.delaySeconds)
            ? dto.delaySeconds
            : null;
        const effectiveDelaySeconds = minutesFromDto != null
            ? Math.max(60, Math.round(minutesFromDto * 60))
            : Math.max(60, Math.round(secondsFromDto ?? 60));
        const delayMs = effectiveDelaySeconds * 1000;
        if (this.scheduledTimer) {
            clearTimeout(this.scheduledTimer);
            this.scheduledTimer = null;
        }
        const scheduledAtMs = Date.now() + delayMs;
        this.scheduledAtMs = scheduledAtMs;
        const ids = await this.userRepo
            .createQueryBuilder('u')
            .select(['u.id'])
            .getMany();
        const recipients = ids;
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
            this.warningTimer = null;
            this.warningAtMs = null;
        }
        if (this.scheduledTimer) {
            clearTimeout(this.scheduledTimer);
            this.scheduledTimer = null;
            this.scheduledAtMs = null;
        }
        const warningLeadMs = 5 * 60 * 1000;
        const warningDelayMs = Math.max(0, delayMs - warningLeadMs);
        this.warningAtMs = scheduledAtMs;
        const imminentMessageBase = typeof dto.message === 'string' && dto.message.trim().length > 0
            ? dto.message.trim()
            : null;
        const defaultImminentMessage = delayMs >= warningLeadMs
            ? 'Mise à jour imminante dans cinq minutes.'
            : `Mise à jour imminante dans ${Math.max(1, Math.round(delayMs / 60_000))} minute(s).`;
        const imminentMessage = imminentMessageBase ?? defaultImminentMessage;
        const fromUserId = admin.id;
        const fromUsername = admin.username;
        const sendImminentNotification = async () => {
            if (this.warningAtMs !== scheduledAtMs)
                return;
            this.warningTimer = null;
            this.warningAtMs = null;
            try {
                const now = Date.now();
                const etaSeconds = Math.max(0, Math.round((scheduledAtMs - now) / 1000));
                await Promise.all(recipients.map((u) => this.notifications.notifyUser(u.id, 'client.update.imminent', {
                    message: imminentMessage,
                    etaSeconds,
                    scheduledAt: new Date(scheduledAtMs).toISOString(),
                    requiresAckDialog: true,
                    fromUserId,
                    fromUsername,
                    timestamp: new Date().toISOString(),
                })));
            }
            catch {
            }
        };
        if (warningDelayMs <= 0) {
            void sendImminentNotification();
        }
        else {
            this.warningTimer = setTimeout(() => void sendImminentNotification(), warningDelayMs);
        }
        const sendForcedUpdate = async () => {
            if (this.scheduledAtMs !== scheduledAtMs)
                return;
            this.scheduledTimer = null;
            try {
                const latest = await this.clientUpdates.getLatest();
                const publishedClickOnce = await this.clientUpdates.getPublishedClickOnceVersionFromDisk();
                const latestVersion = (publishedClickOnce || latest?.version || '').trim() || null;
                if (!latestVersion || (0, version_utils_1.parseVersion)(latestVersion) == null) {
                    this.scheduledAtMs = null;
                    return;
                }
                await this.clientUpdates.saveLatest({
                    version: latestVersion,
                    publishedAt: latest?.publishedAt ?? new Date().toISOString(),
                    message: latest?.message ?? null,
                    publicUrl: latest?.publicUrl ?? null,
                    minRequiredVersion: latestVersion,
                });
                const url = this.clientUpdates.resolveClientPublicUrl(latest);
                await Promise.all(recipients.map((u) => this.notifications.notifyUser(u.id, 'client.update.required', {
                    message: latest?.message ??
                        'Une mise à jour du client est requise pour continuer.',
                    minRequiredVersion: latestVersion,
                    currentVersion: null,
                    publishedAt: latest?.publishedAt ?? null,
                    url,
                    fromUserId,
                    fromUsername,
                    timestamp: new Date().toISOString(),
                })));
            }
            catch {
            }
            this.notifications.disconnectAll('Mise à jour en cours.');
            this.scheduledAtMs = null;
        };
        this.scheduledTimer = setTimeout(() => void sendForcedUpdate(), delayMs);
        return {
            type: 'admin.client.update.schedule',
            payload: {
                delivered: recipients.length,
                scheduledAt: new Date(scheduledAtMs).toISOString(),
                delaySeconds: effectiveDelaySeconds,
            },
        };
    }
};
exports.AdminClientUpdatesWsHandler = AdminClientUpdatesWsHandler;
exports.AdminClientUpdatesWsHandler = AdminClientUpdatesWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        notification_service_1.NotificationService,
        client_updates_service_1.ClientUpdatesService,
        typeorm_2.Repository])
], AdminClientUpdatesWsHandler);
//# sourceMappingURL=admin-client-updates-ws.handler.js.map