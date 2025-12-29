import { Module } from '@nestjs/common';
import { ClientUpdatesController } from './client-updates.controller';
import { AdminClientUpdatesController } from './admin-client-updates.controller';
import { ClientUpdatesService } from './client-updates.service';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';

@Module({
  controllers: [ClientUpdatesController, AdminClientUpdatesController],
  providers: [ClientUpdatesService, HttpJwtGuard, AdminRoleGuard],
})
export class ClientUpdatesModule {}

