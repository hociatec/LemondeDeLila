import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { AdminChatService } from '../../../application/use-cases/admin-chat/admin-chat.service';
import { AdminChatModerationService } from '../../../application/use-cases/admin-chat/admin-chat-moderation.service';
import { WS_EVENTS } from '../../../../realtime/public-api';
import {
  AdminChatBanWsDto,
  AdminChatClearWsDto,
  AdminChatDeleteWsDto,
  AdminChatMessagesWsDto,
  AdminChatSettingsGetWsDto,
  AdminChatSettingsUpdateWsDto,
  AdminChatUnbanWsDto,
} from './dto/admin-ws.dto';

@Injectable()
export class AdminChatWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly chat: AdminChatService,
    private readonly moderation: AdminChatModerationService,
  ) {}

  async chatMessages(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatMessagesWsDto, payload);
    const messages = await this.chat.listMessages(dto);
    return { type: WS_EVENTS.admin.chat.messages, payload: { messages } };
  }

  chatSettingsGet(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminChatSettingsGetWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.chat.settingsGet,
      payload: this.chat.getSettings(),
    };
  }

  async chatSettingsUpdate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatSettingsUpdateWsDto, payload);
    const updated = await this.chat.updateSettings({
      chatHistoryLimit: dto.chatHistoryLimit,
      editWindowSeconds: dto.editWindowSeconds,
    });
    return { type: WS_EVENTS.admin.chat.settingsUpdate, payload: updated };
  }

  async chatDelete(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatDeleteWsDto, payload);
    return {
      type: WS_EVENTS.admin.chat.delete,
      payload: await this.chat.deleteMessage(dto.messageId),
    };
  }

  async chatClear(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminChatClearWsDto, payload);
    return {
      type: WS_EVENTS.admin.chat.clear,
      payload: await this.chat.clearMessages(),
    };
  }

  async chatBan(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminChatBanWsDto, payload);
    const result = await this.moderation.ban({
      userId: dto.id,
      reason: dto.reason,
      durationDays: dto.durationDays,
      byUserId: admin.id,
    });

    return {
      type: WS_EVENTS.admin.chat.ban,
      payload: result,
    };
  }

  async chatUnban(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminChatUnbanWsDto, payload);
    const result = await this.moderation.unban({
      userId: dto.id,
      byUserId: admin.id,
    });
    return {
      type: WS_EVENTS.admin.chat.unban,
      payload: result,
    };
  }
}






