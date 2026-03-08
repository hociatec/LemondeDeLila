"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminClientUpdatesWsHandler", {
    enumerable: true,
    get: function() {
        return AdminClientUpdatesWsHandler;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _notificationservice = require("../../notification/services/notification.service");
const _userentity = require("../../user/entities/user.entity");
const _clientupdatesservice = require("../../client-updates/services/client-updates.service");
const _versionutils = require("../../common/utils/version.utils");
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
let AdminClientUpdatesWsHandler = class AdminClientUpdatesWsHandler {
    async clientUpdateAnnounce(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminClientUpdateAnnounceWsDto, payload);
        const latest = await this.clientUpdates.getLatest();
        const ids = await this.userRepo.createQueryBuilder('u').select([
            'u.id'
        ]).getMany();
        const recipients = ids;
        const message = typeof dto.message === 'string' && dto.message.trim().length > 0 ? dto.message.trim() : 'Une mise à jour du client est disponible.';
        const payloadOut = {
            message,
            // Robustesse: toujours diffuser la version réellement publiée côté serveur.
            version: latest?.version?.trim() || dto.version?.trim() || null,
            fromUserId: admin.id,
            fromUsername: admin.username,
            timestamp: new Date().toISOString()
        };
        await Promise.all(recipients.map((u)=>this.notifications.notifyUser(u.id, 'client.update.available', payloadOut)));
        return {
            type: 'admin.client.update.announce',
            payload: {
                delivered: recipients.length
            }
        };
    }
    async clientUpdateForceLatest(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminClientUpdateForceLatestWsDto, payload ?? {});
        const latest = await this.clientUpdates.getLatest();
        const publishedClickOnce = await this.clientUpdates.getPublishedClickOnceVersionFromDisk();
        const latestVersion = (publishedClickOnce || latest?.version || '').trim() || null;
        if (!latestVersion) {
            throw new _common.BadRequestException('Impossible de forcer la mise à jour : aucune version publiée (latest.json manquant).');
        }
        const message = typeof dto.message === 'string' && dto.message.trim().length > 0 ? dto.message.trim() : 'Une mise à jour du client est requise pour continuer.';
        await this.clientUpdates.saveLatest({
            // Keep the metadata version aligned with what clients can actually download.
            version: latestVersion,
            publishedAt: latest?.publishedAt ?? new Date().toISOString(),
            message: latest?.message ?? null,
            publicUrl: latest?.publicUrl ?? null,
            minRequiredVersion: latestVersion
        });
        const ids = await this.userRepo.createQueryBuilder('u').select([
            'u.id'
        ]).getMany();
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
            timestamp: new Date().toISOString()
        };
        await Promise.all(recipients.map((u)=>this.notifications.notifyUser(u.id, 'client.update.required', payloadOut)));
        return {
            type: 'admin.client.update.forceLatest',
            payload: {
                delivered: recipients.length,
                minRequiredVersion: latestVersion
            }
        };
    }
    async clientUpdateSchedule(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminClientUpdateScheduleWsDto, payload);
        const minutesFromDto = typeof dto.delayMinutes === 'number' && Number.isFinite(dto.delayMinutes) ? dto.delayMinutes : null;
        const secondsFromDto = typeof dto.delaySeconds === 'number' && Number.isFinite(dto.delaySeconds) ? dto.delaySeconds : null;
        const effectiveDelaySeconds = minutesFromDto != null ? Math.max(60, Math.round(minutesFromDto * 60)) : Math.max(60, Math.round(secondsFromDto ?? 60));
        const delayMs = effectiveDelaySeconds * 1000;
        const ids = await this.userRepo.createQueryBuilder('u').select([
            'u.id'
        ]).getMany();
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
        const scheduledAtMs = Date.now() + delayMs;
        this.scheduledAtMs = scheduledAtMs;
        const warningLeadMs = 5 * 60 * 1000;
        const warningDelayMs = Math.max(0, delayMs - warningLeadMs);
        this.warningAtMs = scheduledAtMs;
        const imminentMessageBase = typeof dto.message === 'string' && dto.message.trim().length > 0 ? dto.message.trim() : null;
        const defaultImminentMessage = delayMs >= warningLeadMs ? 'Mise à jour imminante dans cinq minutes.' : `Mise à jour imminante dans ${Math.max(1, Math.round(delayMs / 60_000))} minute(s).`;
        const imminentMessage = imminentMessageBase ?? defaultImminentMessage;
        const fromUserId = admin.id;
        const fromUsername = admin.username;
        const sendImminentNotification = async ()=>{
            if (this.warningAtMs !== scheduledAtMs) return;
            this.warningTimer = null;
            this.warningAtMs = null;
            try {
                const now = Date.now();
                const etaSeconds = Math.max(0, Math.round((scheduledAtMs - now) / 1000));
                await Promise.all(recipients.map((u)=>this.notifications.notifyUser(u.id, 'client.update.imminent', {
                        message: imminentMessage,
                        etaSeconds,
                        scheduledAt: new Date(scheduledAtMs).toISOString(),
                        requiresAckDialog: true,
                        fromUserId,
                        fromUsername,
                        timestamp: new Date().toISOString()
                    })));
            } catch  {
            // ignore
            }
        };
        if (warningDelayMs <= 0) {
            void sendImminentNotification();
        } else {
            this.warningTimer = setTimeout(()=>void sendImminentNotification(), warningDelayMs);
        }
        const sendForcedUpdate = async ()=>{
            if (this.scheduledAtMs !== scheduledAtMs) return;
            this.scheduledTimer = null;
            try {
                const latest = await this.clientUpdates.getLatest();
                const publishedClickOnce = await this.clientUpdates.getPublishedClickOnceVersionFromDisk();
                const latestVersion = (publishedClickOnce || latest?.version || '').trim() || null;
                if (!latestVersion || (0, _versionutils.parseVersion)(latestVersion) == null) {
                    // Sécurité: ne jamais déconnecter tout le monde si aucune version ClickOnce valide n'est publiée.
                    this.scheduledAtMs = null;
                    return;
                }
                await this.clientUpdates.saveLatest({
                    version: latestVersion,
                    publishedAt: latest?.publishedAt ?? new Date().toISOString(),
                    message: latest?.message ?? null,
                    publicUrl: latest?.publicUrl ?? null,
                    minRequiredVersion: latestVersion
                });
                const url = this.clientUpdates.resolveClientPublicUrl(latest);
                await Promise.all(recipients.map((u)=>this.notifications.notifyUser(u.id, 'client.update.required', {
                        message: latest?.message ?? 'Une mise à jour du client est requise pour continuer.',
                        minRequiredVersion: latestVersion,
                        currentVersion: null,
                        publishedAt: latest?.publishedAt ?? null,
                        url,
                        fromUserId,
                        fromUsername,
                        timestamp: new Date().toISOString()
                    })));
            } catch  {
            // ignore
            }
            // Laisser un court délai pour que les clients reçoivent/traitent le signal de mise à jour
            // avant la fermeture WS forcée.
            await new Promise((resolve)=>setTimeout(resolve, 1200));
            this.notifications.disconnectAll('Mise à jour en cours.');
            this.scheduledAtMs = null;
        };
        this.scheduledTimer = setTimeout(()=>void sendForcedUpdate(), delayMs);
        return {
            type: 'admin.client.update.schedule',
            payload: {
                delivered: recipients.length,
                scheduledAt: new Date(scheduledAtMs).toISOString(),
                delaySeconds: effectiveDelaySeconds
            }
        };
    }
    constructor(validator, notifications, clientUpdates, userRepo){
        this.validator = validator;
        this.notifications = notifications;
        this.clientUpdates = clientUpdates;
        this.userRepo = userRepo;
        this.scheduledTimer = null;
        this.scheduledAtMs = null;
        this.warningTimer = null;
        this.warningAtMs = null;
    }
};
AdminClientUpdatesWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(3, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService,
        typeof _clientupdatesservice.ClientUpdatesService === "undefined" ? Object : _clientupdatesservice.ClientUpdatesService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], AdminClientUpdatesWsHandler);
