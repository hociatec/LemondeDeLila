import { Injectable } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { UserGetDto } from './ws.dto';

@Injectable()
export class UserWsHandler {
  constructor(
    private readonly users: UserService,
    private readonly validator: PayloadValidationService,
  ) {}

  async list() {
    const items = await this.users.findAll();
    return { type: 'users.list', payload: { items } };
  }

  async get(payload: unknown) {
    const dto = this.validator.validate(UserGetDto, payload);
    const user = await this.users.findOne(dto.id);
    return { type: 'users.get', payload: { user } };
  }
}
