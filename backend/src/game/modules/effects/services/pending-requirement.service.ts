import { Injectable } from '@nestjs/common';

export type PendingRequirement<TPayload = unknown> = {
  playerId: number;
  type: string;
  payload?: TPayload;
};

@Injectable()
export class PendingRequirementService<TPayload = unknown> {
  private readonly pending = new Map<number, PendingRequirement<TPayload>>();

  set(req: PendingRequirement<TPayload>): void {
    this.pending.set(req.playerId, req);
  }

  get(playerId: number): PendingRequirement<TPayload> | undefined {
    return this.pending.get(playerId);
  }

  clear(playerId: number): void {
    this.pending.delete(playerId);
  }
}
