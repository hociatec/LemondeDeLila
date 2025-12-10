import { Injectable } from '@nestjs/common';
import { UserService } from '../../user/services/user.service';
import { PayloadValidationService } from '../services/payload-validation.service';
import { UserGetDto } from '../dto/user-get.dto';

@Injectable()
export class UserMessageHandler {
  constructor(
    private readonly users: UserService,
    private readonly validator: PayloadValidationService,
  ) {}

  async list() {
    const items = await this.users.findAll();
    return { type: 'users.list', payload: { items } };
  }

  async get(payload: any) {
    const dto = this.validator.validate(UserGetDto, payload);
    const user = await this.users.findOne(dto.id);
    return { type: 'users.get', payload: { user } };
  }
}
