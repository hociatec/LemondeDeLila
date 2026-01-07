import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../guards/http-jwt.guard';
import { WsTicketScope, WsTicketService } from './ws-ticket.service';

const AllowedScopes: WsTicketScope[] = [
  'api',
  'presence',
  'notify',
  'room',
  'game',
];

@Controller('ws')
export class WsTicketController {
  constructor(private readonly tickets: WsTicketService) {}

  @UseGuards(HttpJwtGuard)
  @Get('ticket')
  getTicket(@Req() req: any, @Query('scope') scopeRaw: string) {
    const scope = String(scopeRaw || '')
      .trim()
      .toLowerCase() as WsTicketScope;
    if (!AllowedScopes.includes(scope)) {
      return {
        error: 'scope invalide',
        allowedScopes: AllowedScopes,
      };
    }

    const userId = Number(req?.user?.id ?? 0);
    const res = this.tickets.issue(userId, scope);
    return res;
  }
}
