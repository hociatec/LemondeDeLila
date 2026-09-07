import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtGuard } from '../../../../auth/public-api';
import { WsTicketScope } from '../../../application/contracts/ws-ticket.model';
import { WsTicketService } from '../../../application/services/ws-ticket.service';

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
  @Get('api/ws/ticket')
  getTicket(@Req() req: RequestWithUser, @Query('scope') scopeRaw: string) {
    return this.issue(req, scopeRaw);
  }

  private issue(req: RequestWithUser, scopeRaw: string) {
    const scope = String(scopeRaw || '')
      .trim()
      .toLowerCase() as WsTicketScope;
    if (!AllowedScopes.includes(scope)) {
      return { error: 'scope invalide', allowedScopes: AllowedScopes };
    }

    const userId = Number(req.user?.id ?? 0);
    return this.tickets.issue(userId, scope);
  }
}

type RequestWithUser = Request & {
  user?: {
    id?: number;
  };
};
