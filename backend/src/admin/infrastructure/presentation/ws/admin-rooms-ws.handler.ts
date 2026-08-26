import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { AdminRoomsService } from '../../../application/use-cases/admin-rooms/admin-rooms.service';
import { AdminRoomsCleanupWsDto } from './dto/admin-rooms-cleanup.ws.dto';
import { AdminRoomsDestroyWsDto } from './dto/admin-rooms-destroy.ws.dto';
import { AdminRoomsListWsDto } from './dto/admin-rooms-list.ws.dto';
import { WS_EVENTS } from '../../../../realtime/public-api';
import {
  AdminRoomsSettingsGetWsDto,
  AdminRoomsSettingsUpdateWsDto,
} from './dto/admin-rooms-settings.ws.dto';

@Injectable()
export class AdminRoomsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly rooms: AdminRoomsService,
  ) {}

  async roomsCleanup(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsCleanupWsDto, payload);
    const res = await this.rooms.cleanup(dto);
    return { type: WS_EVENTS.admin.rooms.cleanup, payload: res };
  }

  async roomsList(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsListWsDto, payload ?? {});
    const res = await this.rooms.list(dto);
    return { type: WS_EVENTS.admin.rooms.list, payload: res };
  }

  async roomsDestroy(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsDestroyWsDto, payload);
    const res = await this.rooms.destroy({
      roomId: dto.roomId,
      confirm: dto.confirm,
    });
    return { type: WS_EVENTS.admin.rooms.destroy, payload: res };
  }

  roomsSettingsGet(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminRoomsSettingsGetWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.rooms.settingsGet,
      payload: this.rooms.getSettings(),
    };
  }

  async roomsSettingsUpdate(session: WsSession, payload: unknown) {
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
