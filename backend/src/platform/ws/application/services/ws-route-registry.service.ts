import { Injectable } from '@nestjs/common';
import {
  WsRouteAlreadyRegisteredError,
  WsRouteTypeRequiredError,
} from '../../domain/errors/ws-route-registry.errors';
import { WsRouteHandler } from '../models/ws-route.model';

@Injectable()
export class WsRouteRegistry {
  private readonly routes = new Map<string, WsRouteHandler>();

  register(type: string, handler: WsRouteHandler) {
    const normalized = typeof type === 'string' ? type.trim() : '';
    if (!normalized || normalized.length > 128) {
      throw new WsRouteTypeRequiredError();
    }
    if (this.routes.has(normalized)) {
      throw new WsRouteAlreadyRegisteredError(
        `WS route déjà enregistrée: ${type}`,
      );
    }
    if (this.routes.size >= 512) {
      throw new Error('WS route registry capacity exceeded');
    }
    this.routes.set(normalized, handler);
  }

  get(type: string): WsRouteHandler | undefined {
    return this.routes.get(typeof type === 'string' ? type.trim() : '');
  }

  has(type: string): boolean {
    return this.routes.has(typeof type === 'string' ? type.trim() : '');
  }

  listTypes(): string[] {
    return Array.from(this.routes.keys()).sort((a, b) => a.localeCompare(b));
  }
}
