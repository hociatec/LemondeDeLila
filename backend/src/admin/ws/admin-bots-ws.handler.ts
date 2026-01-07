import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { BotService } from '../../bot/services/bot.service';
import { BotSettingsService } from '../../game/modules/bot/services/bot-settings.service';
import {
  AdminBotNameCreateWsDto,
  AdminBotNameDeleteWsDto,
  AdminBotNameUpdateWsDto,
  AdminBotNamesListWsDto,
  AdminBotSettingsGetWsDto,
  AdminBotSettingsUpdateWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminBotsWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly bots: BotService,
    private readonly botSettings: BotSettingsService,
  ) {}

  async botsNamesList(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminBotNamesListWsDto, payload ?? {});
    const names = await this.bots.listBotNames();
    return {
      type: 'admin.bots.names.list',
      payload: {
        names: names.map((n) => ({
          id: n.id,
          name: n.name,
          enabled: n.enabled,
          createdAt: n.createdAt,
        })),
      },
    };
  }

  async botSettingsGet(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminBotSettingsGetWsDto, payload ?? {});
    return {
      type: 'admin.bots.settings.get',
      payload: this.botSettings.getSettings(),
    };
  }

  async botSettingsUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotSettingsUpdateWsDto, payload);
    const updated = await this.botSettings.updateSettings({
      botTurnDelayMs: dto.botTurnDelayMs,
    });
    return { type: 'admin.bots.settings.update', payload: updated };
  }

  async botNameCreate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameCreateWsDto, payload);
    await this.bots.createBotName(dto.name, dto.enabled ?? true);
    return this.botsNamesList(session, {});
  }

  async botNameUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameUpdateWsDto, payload);
    await this.bots.updateBotName(dto.id, {
      name: dto.name,
      enabled: dto.enabled,
    });
    return this.botsNamesList(session, {});
  }

  async botNameDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameDeleteWsDto, payload);
    await this.bots.deleteBotName(dto.id);
    return this.botsNamesList(session, {});
  }
}
