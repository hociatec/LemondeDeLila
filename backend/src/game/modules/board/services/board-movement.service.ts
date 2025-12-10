import { Injectable } from '@nestjs/common';

@Injectable()
export class BoardMovementService {
  moveCircular(length: number, current: number, steps: number): number {
    if (length <= 0) return current;
    const next = ((current + steps) % length + length) % length;
    return next;
  }

  tileAt<T>(tiles: T[], position: number): T | undefined {
    if (!tiles || tiles.length === 0) return undefined;
    const idx = ((position % tiles.length) + tiles.length) % tiles.length;
    return tiles[idx];
  }
}
