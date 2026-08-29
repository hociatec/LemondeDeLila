import { Global, Module } from '@nestjs/common';
import { WsTicketAuthService } from '../application/services/ws-ticket-auth.service';
import { WsTicketService } from '../application/services/ws-ticket.service';
import { WS_TICKET_CONTROLLERS } from './ws-ticket.module.providers.presentation';
import { WS_TICKET_CORE_PROVIDERS } from './ws-ticket.module.providers.core';

@Global()
@Module({
  controllers: WS_TICKET_CONTROLLERS,
  providers: WS_TICKET_CORE_PROVIDERS,
  exports: [WsTicketService, WsTicketAuthService],
})
export class WsTicketModule {}
