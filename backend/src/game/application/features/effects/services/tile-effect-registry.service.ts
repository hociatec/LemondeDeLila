import { Injectable } from '@nestjs/common';

type Handler<TState, TContext> = (state: TState, context: TContext) => TState;

@Injectable()
export class TileEffectRegistryService<TState = unknown, TContext = unknown> {
  private readonly handlers = new Map<string, Handler<TState, TContext>>();

  register(type: string, handler: Handler<TState, TContext>): void {
    this.handlers.set(type, handler);
  }

  apply(type: string, state: TState, context: TContext): TState {
    const handler = this.handlers.get(type);
    if (!handler) {
      return state;
    }
    return handler(state, context);
  }
}
