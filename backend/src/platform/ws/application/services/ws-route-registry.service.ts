import { Injectable } from '@nestjs/common';
import {
  WsRouteAlreadyRegisteredError,
  WsRouteTypeRequiredError,
} from '../../domain/errors/ws-route-registry.errors';
import { WsRouteHandler } from '../contracts/ws-route.model';

@Injectable()
export class WsRouteRegistry {
  private readonly routes = new Map<string, WsRouteHandler>();

  register(type: string, handler: WsRouteHandler) {
    if (!type || type.trim() === '') {
      throw new WsRouteTypeRequiredError();
    }
    if (this.routes.has(type)) {
      throw new WsRouteAlreadyRegisteredError(
        `WS route déjà enregistrée: ${type}`,
      );
    }
    this.routes.set(type, handler);
  }

  get(type: string): WsRouteHandler | undefined {
    return this.routes.get(type);
  }

  has(type: string): boolean {
    return this.routes.has(type);
  }

  listTypes(): string[] {
    return Array.from(this.routes.keys()).sort((a, b) => a.localeCompare(b));
  }
}
