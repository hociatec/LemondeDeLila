import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { AdminProfileService } from '../../../application/use-cases/admin-profile/admin-profile.service';
import {
  AdminProfileSettingsGetWsDto,
  AdminProfileSettingsUpdateWsDto,
} from './dto/admin-profile-settings.ws.dto';

@Injectable()
export class AdminProfileWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly profile: AdminProfileService,
  ) {}

  profileSettingsGet(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminProfileSettingsGetWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.profile.settingsGet,
      payload: this.profile.getSettings(),
    };
  }

  async profileSettingsUpdate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminProfileSettingsUpdateWsDto,
      payload,
    );
    const updated = await this.profile.updateSettings({
      bioMinLength: dto.bioMinLength,
      bioMaxLength: dto.bioMaxLength,
    });
    return { type: WS_EVENTS.admin.profile.settingsUpdate, payload: updated };
  }
}
