type Handler<TState, TContext> = (state: TState, context: TContext) => TState;
export declare class TileEffectRegistryService<TState = any, TContext = any> {
    private readonly handlers;
    register(type: string, handler: Handler<TState, TContext>): void;
    apply(type: string, state: TState, context: TContext): TState;
}
export {};
