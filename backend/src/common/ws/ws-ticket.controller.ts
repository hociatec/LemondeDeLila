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

@Controller()
export class WsTicketController {
  constructor(private readonly tickets: WsTicketService) {}

  @UseGuards(HttpJwtGuard)
  @Get('ws/ticket')
  getTicket(@Req() req: any, @Query('scope') scopeRaw: string) {
    return this.issue(req, scopeRaw);
  }

  // Some deployments proxy only /api/* to the backend. Provide a compatible path as well.
  @UseGuards(HttpJwtGuard)
  @Get('api/ws/ticket')
  getTicketUnderApi(@Req() req: any, @Query('scope') scopeRaw: string) {
    return this.issue(req, scopeRaw);
  }

  private issue(req: any, scopeRaw: string) {
    const scope = String(scopeRaw || '').trim().toLowerCase() as WsTicketScope;
    if (!AllowedScopes.includes(scope)) {
      return { error: 'scope invalide', allowedScopes: AllowedScopes };
    }

    const userId = Number(req?.user?.id ?? 0);
    return this.tickets.issue(userId, scope);
  }
}
