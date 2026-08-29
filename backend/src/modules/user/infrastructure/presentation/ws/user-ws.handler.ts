import { Injectable } from '@nestjs/common';
import { GetUserService } from '../../../application/use-cases/get-user.service';
import { ListUsersService } from '../../../application/use-cases/list-users.service';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import { UserGetDto, UserListDto } from './dto/user-get.dto';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import {
  requireUser,
  type WsSession,
} from '../../../../../platform/realtime/public-api';

@Injectable()
export class UserWsHandler {
  constructor(
    private readonly getUser: GetUserService,
    private readonly listUsers: ListUsersService,
    private readonly validator: PayloadValidationService,
  ) {}

  async list(session: WsSession, payload: unknown = {}) {
    requireUser(session);
    const dto = this.validator.validate(UserListDto, payload ?? {});
    const items = await this.listUsers.execute(dto);
    return { type: WS_EVENTS.users.list, payload: { items } };
  }

  async get(session: WsSession, payload: unknown) {
    requireUser(session);
    const dto = this.validator.validate(UserGetDto, payload);
    const user = await this.getUser.execute(dto.id);
    return { type: WS_EVENTS.users.get, payload: { user } };
  }
}
