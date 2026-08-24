import { Injectable } from '@nestjs/common';
import { TileEffectRegistryService } from './tile-effect-registry.service';

export type StandEffectContext<TState = unknown> = {
  state: TState;
  playerId: number;
  standId: string;
};

@Injectable()
export class StandEffectRegistryService<TState = unknown> {
  constructor(
    private readonly tiles: TileEffectRegistryService<
      TState,
      StandEffectContext<TState>
    >,
  ) {}

  registerStand(
    type: string,
    handler: (state: TState, ctx: StandEffectContext<TState>) => TState,
  ): void {
    this.tiles.register(type, (s, ctx) => handler(s, ctx));
  }

  applyStand(
    type: string,
    state: TState,
    ctx: StandEffectContext<TState>,
  ): TState {
    return this.tiles.apply(type, state, ctx);
  }
}
