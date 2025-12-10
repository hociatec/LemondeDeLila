import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
import { AdminListUsersDto } from '../dto/admin-list-users.dto';
import { AdminBanUserDto } from '../dto/admin-ban-user.dto';
import { HttpJwtGuard } from '../../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('api/admin/users')
@UseGuards(HttpJwtGuard, AdminRoleGuard)
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async list(@Query() query: AdminListUsersDto) {
    return this.adminUsers.list(query);
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsers.get(id);
  }

  @Post()
  async create(@Body() body: AdminCreateUserDto) {
    return this.adminUsers.create(body);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: AdminUpdateUserDto) {
    return this.adminUsers.update(id, body);
  }

  @Post(':id/reset-password')
  async resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsers.resetPassword(id);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsers.delete(id);
  }

  @Post(':id/ban')
  async ban(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminBanUserDto,
  ) {
    return this.adminUsers.ban(id, body.reason, body.durationDays, body.bannedUntil);
  }

  @Post(':id/unban')
  async unban(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsers.unban(id);
  }
}
