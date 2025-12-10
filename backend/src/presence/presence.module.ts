import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { PresenceGateway } from './gateways/presence.gateway';
import { PresenceService } from './services/presence.service';

@Module({
  imports: [ChatModule],
  providers: [PresenceGateway, PresenceService],
})
export class PresenceModule {}
