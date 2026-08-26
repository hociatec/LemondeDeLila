import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { AdminBotsService } from '../../../application/use-cases/admin-bots/admin-bots.service';
import {
  AdminBotNameCreateWsDto,
  AdminBotNameDeleteWsDto,
  AdminBotNameUpdateWsDto,
  AdminBotNamesListWsDto,
  AdminBotSettingsGetWsDto,
  AdminBotSettingsUpdateWsDto,
} from './dto/admin-ws.dto';

@Injectable()
export class AdminBotsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly adminBots: AdminBotsService,
  ) {}

  async botsNamesList(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminBotNamesListWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.bots.namesList,
      payload: await this.adminBots.listNames(),
    };
  }

  botSettingsGet(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminBotSettingsGetWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.bots.settingsGet,
      payload: this.adminBots.getSettings(),
    };
  }

  async botSettingsUpdate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotSettingsUpdateWsDto, payload);
    const updated = await this.adminBots.updateSettings({
      botTurnDelayMs: dto.botTurnDelayMs,
      botStartDelayMs: dto.botStartDelayMs,
      botDrawDelayMs: dto.botDrawDelayMs,
    });
    return { type: WS_EVENTS.admin.bots.settingsUpdate, payload: updated };
  }

  async botNameCreate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameCreateWsDto, payload);
    return {
      type: WS_EVENTS.admin.bots.namesList,
      payload: await this.adminBots.createName(dto.name, dto.enabled ?? true),
    };
  }

  async botNameUpdate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameUpdateWsDto, payload);
    return {
      type: WS_EVENTS.admin.bots.namesList,
      payload: await this.adminBots.updateName(dto.id, {
        name: dto.name,
        enabled: dto.enabled,
      }),
    };
  }

  async botNameDelete(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameDeleteWsDto, payload);
    return {
      type: WS_EVENTS.admin.bots.namesList,
      payload: await this.adminBots.deleteName(dto.id),
    };
  }
}
