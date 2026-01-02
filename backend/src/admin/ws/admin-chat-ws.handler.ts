import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { ChatService } from '../../chat/services/chat.service';
import { ChatSettingsService } from '../../chat/services/chat-settings.service';
import { User } from '../../user/entities/user.entity';
import {
  AdminChatBanWsDto,
  AdminChatClearWsDto,
  AdminChatDeleteWsDto,
  AdminChatMessagesWsDto,
  AdminChatSettingsGetWsDto,
  AdminChatSettingsUpdateWsDto,
  AdminChatUnbanWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminChatWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly chat: ChatService,
    private readonly chatSettings: ChatSettingsService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async chatMessages(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatMessagesWsDto, payload);
    const rows = await this.chat.adminListMessages(
      dto.limit ?? this.chatSettings.getChatHistoryLimit(),
      dto.includeDeleted ?? false,
    );
    const messages = rows.map((m) => ({
      id: m.messageId,
      text: m.message,
      createdAt:
        m.createdAt instanceof Date
          ? m.createdAt.toISOString()
          : new Date().toISOString(),
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
      user: {
        id: m.user?.id ?? null,
        username: m.user?.username ?? null,
        avatar: m.user?.avatar ?? null,
        chatBannedUntil: m.user?.chatBannedUntil
          ? m.user.chatBannedUntil instanceof Date
            ? m.user.chatBannedUntil.toISOString()
            : null
          : null,
        chatBanReason: m.user?.chatBanReason ?? null,
      },
    }));
    return { type: 'admin.chat.messages', payload: { messages } };
  }

  async chatSettingsGet(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminChatSettingsGetWsDto, payload ?? {});
    return { type: 'admin.chat.settings.get', payload: this.chatSettings.getSettings() };
  }

  async chatSettingsUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatSettingsUpdateWsDto, payload);
    const updated = await this.chatSettings.updateSettings({
      chatHistoryLimit: dto.chatHistoryLimit,
    });
    return { type: 'admin.chat.settings.update', payload: updated };
  }

  async chatDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatDeleteWsDto, payload);
    const ok = await this.chat.adminDeleteMessage(dto.messageId);
    return { type: 'admin.chat.delete', payload: { ok } };
  }

  async chatClear(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminChatClearWsDto, payload);
    const deleted = await this.chat.adminClearAll();
    return { type: 'admin.chat.clear', payload: { deleted } };
  }

  async chatBan(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminChatBanWsDto, payload);
    const user = await this.userRepo.findOne({ where: { id: dto.id } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const days = dto.durationDays && dto.durationDays > 0 ? dto.durationDays : 3650;
    const until = new Date(Date.now() + days * 24 * 60 * 60_000);
    user.chatBannedUntil = until;
    user.chatBanReason = (dto.reason || '').trim() || null;
    await this.userRepo.save(user);

    return {
      type: 'admin.chat.ban',
      payload: {
        ok: true,
        userId: user.id,
        chatBannedUntil: until.toISOString(),
        chatBanReason: user.chatBanReason,
        byUserId: admin.id,
      },
    };
  }

  async chatUnban(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminChatUnbanWsDto, payload);
    const user = await this.userRepo.findOne({ where: { id: dto.id } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    user.chatBannedUntil = null;
    user.chatBanReason = null;
    await this.userRepo.save(user);
    return {
      type: 'admin.chat.unban',
      payload: { ok: true, userId: user.id, byUserId: admin.id },
    };
  }
}

