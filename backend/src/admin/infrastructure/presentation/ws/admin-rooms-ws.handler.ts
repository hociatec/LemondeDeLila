import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { AdminRoomsService } from '../../../application/use-cases/admin-rooms/admin-rooms.service';
import { AdminRoomsCleanupWsDto } from './admin-rooms-cleanup.dto';
import { AdminRoomsDestroyWsDto } from './admin-rooms-destroy.dto';
import { AdminRoomsListWsDto } from './admin-rooms-list.dto';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import {
  AdminRoomsSettingsGetWsDto,
  AdminRoomsSettingsUpdateWsDto,
} from './admin-rooms-settings.dto';

@Injectable()
export class AdminRoomsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly rooms: AdminRoomsService,
  ) {}

  async roomsCleanup(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsCleanupWsDto, payload);
    const res = await this.rooms.cleanup(dto);
    return { type: WS_EVENTS.admin.rooms.cleanup, payload: res };
  }

  async roomsList(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsListWsDto, payload ?? {});
    const res = await this.rooms.list(dto);
    return { type: WS_EVENTS.admin.rooms.list, payload: res };
  }

  async roomsDestroy(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsDestroyWsDto, payload);
    const res = await this.rooms.destroy(dto);
    return { type: WS_EVENTS.admin.rooms.destroy, payload: res };
  }

  roomsSettingsGet(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminRoomsSettingsGetWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.rooms.settingsGet,
      payload: this.rooms.getSettings(),
    };
  }

  async roomsSettingsUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsSettingsUpdateWsDto, payload);
    const updated = await this.rooms.updateSettings({
      autoCleanupEnabled:
        typeof dto.autoCleanupEnabled === 'boolean'
          ? dto.autoCleanupEnabled
          : undefined,
      autoCleanupOlderThanMinutes: dto.autoCleanupOlderThanMinutes ?? undefined,
      autoCleanupIntervalSeconds: dto.autoCleanupIntervalSeconds ?? undefined,
      autoCleanupLimit: dto.autoCleanupLimit ?? undefined,
    });
    return { type: WS_EVENTS.admin.rooms.settingsUpdate, payload: updated };
  }
}





