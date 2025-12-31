import { Global, Module } from '@nestjs/common';
import { WsTicketController } from './ws-ticket.controller';
import { WsTicketService } from './ws-ticket.service';
import { WsTicketAuthService } from './ws-ticket-auth.service';

@Global()
@Module({
  controllers: [WsTicketController],
  providers: [WsTicketService, WsTicketAuthService],
  exports: [WsTicketService, WsTicketAuthService],
})
export class WsTicketModule {}
