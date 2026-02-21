import { BadRequestException, Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { RoomService } from '../../room/services/room.service';
import { RoomMaintenanceSettingsService } from '../../room/services/room-maintenance-settings.service';
import { AdminRoomsCleanupWsDto } from './admin-rooms-cleanup.dto';
import { AdminRoomsDestroyWsDto } from './admin-rooms-destroy.dto';
import { AdminRoomsListWsDto } from './admin-rooms-list.dto';
import {
  AdminRoomsSettingsGetWsDto,
  AdminRoomsSettingsUpdateWsDto,
} from './admin-rooms-settings.dto';

@Injectable()
export class AdminRoomsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly rooms: RoomService,
    private readonly roomSettings: RoomMaintenanceSettingsService,
  ) {}

  async roomsCleanup(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsCleanupWsDto, payload);
    if (dto.confirm !== true) {
      throw new BadRequestException('Confirmation requise.');
    }
    const res = await this.rooms.adminCleanupRooms({
      includePrivate: dto.includePrivate === true,
      includeStarted: dto.includeStarted === true,
      olderThanMinutes: dto.olderThanMinutes,
      limit: dto.limit,
      dryRun: dto.dryRun === true,
      excludeActivePlayers: true,
    });
    return { type: 'admin.rooms.cleanup', payload: res };
  }

  async roomsList(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsListWsDto, payload ?? {});
    const res = await this.rooms.adminListRooms({
      limit: dto.limit,
      includePrivate: dto.includePrivate !== false,
      includeStarted: dto.includeStarted === true,
      joinableOnly: dto.joinableOnly === true,
    });
    return { type: 'admin.rooms.list', payload: res };
  }

  async roomsDestroy(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsDestroyWsDto, payload);
    if (dto.confirm !== true) {
      throw new BadRequestException('Confirmation requise.');
    }
    const res = await this.rooms.adminDestroyRoom(dto.roomId);
    return { type: 'admin.rooms.destroy', payload: res };
  }

  roomsSettingsGet(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminRoomsSettingsGetWsDto, payload ?? {});
    return {
      type: 'admin.rooms.settings.get',
      payload: this.roomSettings.get(),
    };
  }

  async roomsSettingsUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsSettingsUpdateWsDto, payload);
    const updated = await this.roomSettings.update({
      autoCleanupEnabled:
        typeof dto.autoCleanupEnabled === 'boolean'
          ? dto.autoCleanupEnabled
          : undefined,
      autoCleanupOlderThanMinutes: dto.autoCleanupOlderThanMinutes ?? undefined,
      autoCleanupIntervalSeconds: dto.autoCleanupIntervalSeconds ?? undefined,
      autoCleanupLimit: dto.autoCleanupLimit ?? undefined,
    });
    return { type: 'admin.rooms.settings.update', payload: updated };
  }
}
