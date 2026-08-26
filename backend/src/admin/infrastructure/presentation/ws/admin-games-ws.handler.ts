import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { AdminGamesManagementService } from '../../../application/use-cases/admin-games/admin-games-management.service';
import {
  AdminGameCategoryAssignWsDto,
  AdminGameCategoryCreateWsDto,
  AdminGameCategoryDeleteWsDto,
  AdminGameCategoryUpdateWsDto,
  AdminGameCategoriesListWsDto,
  AdminGameResetWsDto,
  AdminGameSetEnabledWsDto,
  AdminGameUpdateWsDto,
} from './dto/admin-ws.dto';

@Injectable()
export class AdminGamesWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly games: AdminGamesManagementService,
  ) {}

  async gamesList(session: WsSession) {
    requireAdmin(session);
    return {
      type: WS_EVENTS.admin.games.list,
      payload: await this.games.listGames(),
    };
  }

  gamesCategoriesList(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminGameCategoriesListWsDto, payload ?? {});
    return {
      type: WS_EVENTS.admin.games.categories,
      payload: this.games.listCategories(),
    };
  }

  async gamesCategoryCreate(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryCreateWsDto, payload);
    return {
      type: WS_EVENTS.admin.games.categories,
      payload: await this.games.createCategory(admin.id, dto),
    };
  }

  async gamesCategoryUpdate(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryUpdateWsDto, payload);
    return {
      type: WS_EVENTS.admin.games.categories,
      payload: await this.games.updateCategory(admin.id, dto),
    };
  }

  async gamesCategoryAssign(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryAssignWsDto, payload);
    return {
      type: WS_EVENTS.admin.games.categoryAssign,
      payload: await this.games.assignCategory(admin.id, dto),
    };
  }

  async gamesCategoryDelete(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryDeleteWsDto, payload);
    return {
      type: WS_EVENTS.admin.games.categories,
      payload: await this.games.deleteCategory(admin.id, dto.id),
    };
  }

  async gamesSetEnabled(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameSetEnabledWsDto, payload);
    return {
      type: WS_EVENTS.admin.games.setEnabled,
      payload: await this.games.setEnabled(admin.id, dto),
    };
  }

  async gamesUpdate(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameUpdateWsDto, payload);
    return {
      type: WS_EVENTS.admin.games.update,
      payload: await this.games.updateGame(admin.id, {
        gameType: dto.gameType,
        enabled: dto.enabled,
        minPlayers: dto.minPlayers,
        maxPlayers: dto.maxPlayers,
        name: dto.name,
        description: dto.description,
        rules: dto.rules,
        status: dto.status,
        chatEnabled: dto.chatEnabled,
        chatSoundsEnabled: dto.chatSoundsEnabled,
      }),
    };
  }

  async gamesReset(session: WsSession, payload: unknown) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameResetWsDto, payload);
    return {
      type: WS_EVENTS.admin.games.reset,
      payload: await this.games.resetGame(admin.id, dto.gameType),
    };
  }
}
