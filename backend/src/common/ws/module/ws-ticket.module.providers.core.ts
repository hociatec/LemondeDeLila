import { ConfigService } from '@nestjs/config';
import { HttpJwtGuard, JwtPayloadVerifierService } from '../../auth/public-api';
import { WS_RUNTIME_CONFIG } from '../application/ports/ws-runtime-config.port';
import { WsTicketAuthService } from '../application/services/ws-ticket-auth.service';
import { WsTicketService } from '../application/services/ws-ticket.service';
import { createWsRuntimeConfig } from '../infrastructure/config/ws-runtime.config';

export const WS_TICKET_CORE_PROVIDERS = [
  {
    provide: WS_RUNTIME_CONFIG,
    inject: [ConfigService],
    useFactory: createWsRuntimeConfig,
  },
  JwtPayloadVerifierService,
  HttpJwtGuard,
  WsTicketService,
  WsTicketAuthService,
];
