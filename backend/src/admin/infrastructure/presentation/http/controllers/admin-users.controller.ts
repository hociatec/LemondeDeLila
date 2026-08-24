import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateAdminUserCommand,
  ListAdminUsersQuery,
  UpdateAdminUserCommand,
} from '../../../../application/use-cases/admin-users/admin-users.commands';
import { AdminUserRolesUpdateService } from '../../../../application/use-cases/admin-users/admin-user-roles-update.service';
import { AdminUsersCommandService } from '../../../../application/use-cases/admin-users/admin-users-command.service';
import { AdminUsersQueryService } from '../../../../application/use-cases/admin-users/admin-users-query.service';
import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
import { AdminListUsersDto } from '../dto/admin-list-users.dto';
import { AdminBanUserDto } from '../dto/admin-ban-user.dto';
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../../../common/auth/public-api';

@Controller('api/admin/users')
@UseGuards(HttpJwtGuard, AdminRoleGuard)
export class AdminUsersController {
  constructor(
    private readonly adminUsersQueries: AdminUsersQueryService,
    private readonly adminUsersCommands: AdminUsersCommandService,
    private readonly adminUserRolesUpdate: AdminUserRolesUpdateService,
  ) {}

  @Get()
  async list(@Query() query: AdminListUsersDto) {
    return this.adminUsersQueries.list(this.toListQuery(query));
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersQueries.get(id);
  }

  @Post()
  async create(@Body() body: AdminCreateUserDto) {
    return this.adminUsersCommands.create(this.toCreateCommand(body));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminUpdateUserDto,
  ) {
    return this.adminUsersCommands.update(id, this.toUpdateCommand(body));
  }

  @Post(':id/reset-password')
  async resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersCommands.resetPassword(id);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersCommands.delete(id);
  }

  @Post(':id/ban')
  async ban(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminBanUserDto,
  ) {
    return this.adminUsersCommands.ban(
      id,
      body.reason,
      body.durationDays,
      body.bannedUntil,
    );
  }

  @Post(':id/unban')
  async unban(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersCommands.unban(id);
  }

  private toListQuery(query: AdminListUsersDto): ListAdminUsersQuery {
    return {
      search: query.search,
      role: query.role,
      status: query.status,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
      page: query.page,
      limit: query.limit,
    };
  }

  private toCreateCommand(body: AdminCreateUserDto): CreateAdminUserCommand {
    return {
      email: body.email,
      username: body.username,
      password: body.password,
      roles: body.roles,
      avatar: body.avatar,
      emailVerified: body.emailVerified,
    };
  }

  private toUpdateCommand(body: AdminUpdateUserDto): UpdateAdminUserCommand {
    return {
      email: body.email,
      username: body.username,
      password: body.password,
      roles: body.roles,
      avatar: body.avatar,
      emailVerified: body.emailVerified,
      bannedUntil: body.bannedUntil,
      banReason: body.banReason,
    };
  }
}


