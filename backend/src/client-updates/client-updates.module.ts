import { Module } from '@nestjs/common';
import { ClientUpdatesController } from './client-updates.controller';
import { AdminClientUpdatesController } from './admin-client-updates.controller';
import { CiClientUpdatesController } from './ci-client-updates.controller';
import { ClientUpdatesService } from './client-updates.service';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { ClientUpdatesUploadTokenGuard } from './client-updates-upload-token.guard';

@Module({
  controllers: [
    ClientUpdatesController,
    AdminClientUpdatesController,
    CiClientUpdatesController,
  ],
  providers: [
    ClientUpdatesService,
    HttpJwtGuard,
    AdminRoleGuard,
    ClientUpdatesUploadTokenGuard,
  ],
  exports: [ClientUpdatesService],
})
export class ClientUpdatesModule {}
