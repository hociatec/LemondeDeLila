import { Injectable } from '@nestjs/common';
import type { WsAuthPayload } from '../interfaces/ws-auth-payload';

export type WsIncomingMessage = {
  type?: string;
  payload?: any;
  requestId?: string;
};

export type WsSession = {
  user: WsAuthPayload | null;
  connectionId: string;
};

export type WsRouteHandler = (
  session: WsSession,
  payload: any,
) => Promise<{ type: string; payload: any } | null>;

@Injectable()
export class WsRouteRegistry {
  private readonly routes = new Map<string, WsRouteHandler>();

  register(type: string, handler: WsRouteHandler) {
    if (!type || type.trim() === '') {
      throw new Error('WS route type requis');
    }
    if (this.routes.has(type)) {
      throw new Error(`WS route déjà enregistrée: ${type}`);
    }
    this.routes.set(type, handler);
  }

  get(type: string): WsRouteHandler | undefined {
    return this.routes.get(type);
  }
}
