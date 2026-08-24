import { Injectable } from '@nestjs/common';

@Injectable()
export class BoardEffectsPoliciesService {
  isMovementBlocked(params: {
    blockedTiles?: Array<{ x: number; y: number }>;
    x: number;
    y: number;
  }): boolean {
    return (params.blockedTiles ?? []).some(
      (tile) => tile.x === params.x && tile.y === params.y,
    );
  }
}
