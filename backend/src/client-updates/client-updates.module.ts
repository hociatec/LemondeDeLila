import { Module } from '@nestjs/common';
import { ClientUpdatesController } from './controllers/client-updates.controller';
import { AdminClientUpdatesController } from './controllers/admin-client-updates.controller';
import { CiClientUpdatesController } from './controllers/ci-client-updates.controller';
import { ClientUpdatesService } from './services/client-updates.service';
import { ClientUpdatesStaticService } from './services/client-updates-static.service';
import { ClientUpdatesUploadService } from './services/client-updates-upload.service';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { ClientUpdatesUploadTokenGuard } from './guards/client-updates-upload-token.guard';

@Module({
  controllers: [
    ClientUpdatesController,
    AdminClientUpdatesController,
    CiClientUpdatesController,
  ],
  providers: [
    ClientUpdatesService,
    ClientUpdatesStaticService,
    ClientUpdatesUploadService,
    HttpJwtGuard,
    AdminRoleGuard,
    ClientUpdatesUploadTokenGuard,
  ],
  exports: [ClientUpdatesService],
})
export class ClientUpdatesModule {}
