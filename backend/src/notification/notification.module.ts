import { Module } from '@nestjs/common';
import { NotificationGateway } from './gateways/notification.gateway';
import { NotificationService } from './services/notification.service';

@Module({
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService],
})
export class NotificationModule {}

