import { Injectable } from '@nestjs/common';
import { GetUserService } from '../../../application/use-cases/get-user.service';
import { ListUsersService } from '../../../application/use-cases/list-users.service';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { UserGetDto } from './dto/user-get.dto';
import { WS_EVENTS } from '../../../../realtime/public-api';

@Injectable()
export class UserWsHandler {
  constructor(
    private readonly getUser: GetUserService,
    private readonly listUsers: ListUsersService,
    private readonly validator: PayloadValidationService,
  ) {}

  async list() {
    const items = await this.listUsers.execute();
    return { type: WS_EVENTS.users.list, payload: { items } };
  }

  async get(payload: unknown) {
    const dto = this.validator.validate(UserGetDto, payload);
    const user = await this.getUser.execute(dto.id);
    return { type: WS_EVENTS.users.get, payload: { user } };
  }
}
