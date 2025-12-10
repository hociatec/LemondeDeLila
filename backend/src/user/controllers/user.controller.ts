import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { User } from '../entities/user.entity';

@Controller('api/users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  async list(): Promise<User[]> {
    return this.users.findAll();
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.users.findOne(id);
  }
}
