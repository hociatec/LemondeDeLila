import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { SocialProfileSettingsService } from '../../social/services/social-profile-settings.service';
import {
import { WS_EVENTS } from '../../common/ws/ws-events';
  AdminProfileSettingsGetWsDto,
  AdminProfileSettingsUpdateWsDto,
} from './admin-profile-settings.dto';

@Injectable()
export class AdminProfileWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly settings: SocialProfileSettingsService,
  ) {}

  profileSettingsGet(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminProfileSettingsGetWsDto, payload ?? {});
    return { type: WS_EVENTS.admin.profile.settingsGet, payload: this.settings.get() };
  }

  async profileSettingsUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminProfileSettingsUpdateWsDto,
      payload,
    );
    const updated = await this.settings.update({
      bioMinLength: dto.bioMinLength,
      bioMaxLength: dto.bioMaxLength,
    });
    return { type: WS_EVENTS.admin.profile.settingsUpdate, payload: updated };
  }
}

